// F1238: Test DB seed
// F1239: Test DB teardown
// Test database setup and cleanup utilities

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ivhfuhxorppptyuofbgq.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

let supabase: ReturnType<typeof createClient> | null = null

/**
 * Get or create Supabase test client
 */
export function getTestSupabase() {
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey)
  }
  return supabase
}

/**
 * F1238: Seed test database with sample data
 */
export async function seedTestDB() {
  const client = getTestSupabase()

  // Seed test contacts
  const testContacts = [
    {
      name: 'Test Contact 1',
      phone: '+15555551001',
      email: 'test1@example.com',
      company: 'Test Company A',
      sms_consent: true,
    },
    {
      name: 'Test Contact 2',
      phone: '+15555551002',
      email: 'test2@example.com',
      company: 'Test Company B',
      sms_consent: false,
    },
    {
      name: 'Test Contact 3',
      phone: '+15555551003',
      email: 'test3@example.com',
      sms_consent: true,
    },
  ]

  const { data: contacts, error: contactsError } = await client
    .from('contacts')
    .upsert(testContacts, { onConflict: 'phone' })
    .select()

  if (contactsError) {
    console.error('Error seeding contacts:', contactsError)
  }

  // Seed test personas
  const testPersonas = [
    {
      name: 'Test Sales Assistant',
      voice_id: 'test-voice-1',
      system_prompt: 'You are a test sales assistant',
      first_message: 'Hello from test!',
      active: true,
    },
  ]

  const { data: personas, error: personasError } = await client
    .from('agent_personas')
    .upsert(testPersonas, { onConflict: 'name' })
    .select()

  if (personasError) {
    console.error('Error seeding personas:', personasError)
  }

  // Seed test campaigns
  if (contacts && contacts.length > 0 && personas && personas.length > 0) {
    const testCampaigns = [
      {
        name: 'Test Campaign 1',
        persona_id: personas[0].id,
        status: 'draft',
        total_contacts: 3,
        completed_contacts: 0,
      },
    ]

    const { data: campaigns, error: campaignsError } = await client
      .from('campaigns')
      .upsert(testCampaigns, { onConflict: 'name' })
      .select()

    if (campaignsError) {
      console.error('Error seeding campaigns:', campaignsError)
    }
  }

  return {
    contacts,
    personas,
  }
}

/**
 * F1239: Clean up test database
 * Removes all test data created during tests
 */
export async function teardownTestDB() {
  const client = getTestSupabase()

  // Delete test data in reverse dependency order
  const tables = [
    'call_logs',
    'sms_logs',
    'bookings',
    'campaign_contacts',
    'campaigns',
    'agent_personas',
    'contacts',
    'dnc_list',
  ]

  for (const table of tables) {
    try {
      // Delete test records (those with test phone numbers or names starting with "Test")
      await client
        .from(table)
        .delete()
        .or('phone.like.+1555555%,name.like.Test%')
    } catch (error) {
      // Ignore errors for tables that don't exist or don't have these columns
      console.debug(`Could not clean ${table}:`, error)
    }
  }
}

/**
 * Clean specific test data by ID patterns
 */
export async function cleanupTestData(pattern: string) {
  const client = getTestSupabase()

  // Common test cleanup patterns
  const cleanupQueries = [
    client.from('contacts').delete().like('phone', `${pattern}%`),
    client.from('call_logs').delete().like('call_id', `${pattern}%`),
    client.from('sms_logs').delete().like('message_sid', `${pattern}%`),
  ]

  await Promise.allSettled(cleanupQueries)
}

/**
 * Create isolated test environment
 * Returns cleanup function
 */
export async function withTestDB<T>(
  testFn: () => Promise<T>
): Promise<T> {
  await seedTestDB()

  try {
    return await testFn()
  } finally {
    await teardownTestDB()
  }
}
