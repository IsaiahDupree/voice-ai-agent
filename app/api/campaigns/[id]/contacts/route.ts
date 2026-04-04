import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0182: Contact list upload - Add contacts to a campaign
// F0183: Contact list validate - Validates phone numbers
// F0184: Contact dedup - Prevents duplicate contacts in campaign

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { contacts } = body // Array of { phone, name, email, metadata }

    if (!contacts || !Array.isArray(contacts)) {
      return NextResponse.json(
        { error: 'contacts array is required' },
        { status: 400 }
      )
    }

    // F0183: Contact list validate - validate phone numbers
    const phoneRegex = /^\+?[1-9]\d{10,14}$/ // E.164 format
    const validContacts = []
    const invalidContacts = []

    for (const contact of contacts) {
      if (!contact.phone) {
        invalidContacts.push({ contact, reason: 'Missing phone number' })
        continue
      }

      if (!phoneRegex.test(contact.phone)) {
        invalidContacts.push({ contact, reason: 'Invalid phone format (use E.164: +1234567890)' })
        continue
      }

      validContacts.push(contact)
    }

    if (validContacts.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid contacts to add',
          invalid_count: invalidContacts.length,
          invalid_contacts: invalidContacts.slice(0, 10), // Show first 10 invalid
        },
        { status: 400 }
      )
    }

    // First, ensure all contacts exist in voice_agent_contacts table
    const contactRecords = []
    for (const contact of validContacts) {
      const { data, error } = await supabaseAdmin
        .from('voice_agent_contacts')
        .upsert(
          {
            phone: contact.phone,
            name: contact.name,
            email: contact.email,
            metadata: contact.metadata,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'phone' }
        )
        .select()
        .single()

      if (!error && data) {
        contactRecords.push(data)
      }
    }

    // F0184: Contact dedup - Check for existing campaign contacts
    const { data: existingCampaignContacts } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('contact_id')
      .eq('campaign_id', params.id)

    const existingContactIds = new Set(
      existingCampaignContacts?.map((c) => c.contact_id) || []
    )

    // Add to campaign_contacts (only new ones)
    const campaignContacts = contactRecords
      .filter((c) => !existingContactIds.has(c.id))
      .map((contact) => ({
        campaign_id: parseInt(params.id),
        contact_id: contact.id,
        status: 'pending',
        attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

    let addedCount = 0
    if (campaignContacts.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('voice_agent_campaign_contacts')
        .insert(campaignContacts)
        .select()

      if (error) throw error
      addedCount = data?.length || 0
    }

    const skippedCount = contactRecords.length - addedCount

    return NextResponse.json(
      {
        success: true,
        message: `Added ${addedCount} contacts to campaign`,
        stats: {
          total_submitted: contacts.length,
          valid: validContacts.length,
          invalid: invalidContacts.length,
          added: addedCount,
          skipped_duplicates: skippedCount,
        },
        invalid_contacts: invalidContacts.slice(0, 10),
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error adding contacts to campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add contacts' },
      { status: 500 }
    )
  }
}

// List campaign contacts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select(`
        *,
        contact:voice_agent_contacts(*)
      `)
      .eq('campaign_id', params.id)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      contacts: data || [],
    })
  } catch (error: any) {
    console.error('Error listing campaign contacts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list contacts' },
      { status: 500 }
    )
  }
}
