/**
 * Persona Builder utilities
 * Handles persona configuration, templates, and campaign assignments
 */

import { supabaseAdmin } from '@/lib/supabase'

export interface PersonaVariable {
  name: string
  description: string
  example_value: string
  category: 'contact' | 'call' | 'campaign' | 'system'
}

export interface Persona {
  id: string
  name: string
  voice_id: string
  system_prompt: string
  first_message: string
  opening_script?: string
  closing_script?: string
  fallback_phrases: string[]
  vapi_assistant_id: string
  max_call_duration_minutes?: number
  silence_timeout_seconds?: number
  is_default?: boolean
  webhook_url?: string
  org_id?: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface PersonaCampaignAssignment {
  persona_id: string
  campaign_id: string
}

/**
 * F0770: Get available prompt variables
 */
export async function getPromptVariables(): Promise<PersonaVariable[]> {
  const supabase = supabaseAdmin

  try {
    const { data, error } = await supabase
      .from('persona_variables')
      .select('name, description, example_value, category')
      .order('category')

    if (error) {
      console.error('Error fetching persona variables:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getPromptVariables:', error)
    return []
  }
}

/**
 * F0770: Get variables grouped by category
 */
export function groupVariablesByCategory(variables: PersonaVariable[]) {
  const grouped: Record<string, PersonaVariable[]> = {}

  variables.forEach(v => {
    if (!grouped[v.category]) {
      grouped[v.category] = []
    }
    grouped[v.category].push(v)
  })

  return grouped
}

/**
 * F0786: Get campaigns assigned to persona
 */
export async function getPersonaCampaigns(personaId: string): Promise<string[]> {
  const supabase = supabaseAdmin

  try {
    const { data, error } = await supabase
      .from('persona_campaigns')
      .select('campaign_id')
      .eq('persona_id', personaId)

    if (error) {
      console.error('Error fetching persona campaigns:', error)
      return []
    }

    return data?.map(d => d.campaign_id) || []
  } catch (error) {
    console.error('Error in getPersonaCampaigns:', error)
    return []
  }
}

/**
 * F0786: Assign persona to campaigns
 */
export async function assignPersonaToCampaigns(
  personaId: string,
  campaignIds: string[]
): Promise<boolean> {
  const supabase = supabaseAdmin

  try {
    // Delete existing assignments
    await supabase
      .from('persona_campaigns')
      .delete()
      .eq('persona_id', personaId)

    // Insert new assignments
    if (campaignIds.length > 0) {
      const { error } = await supabase
        .from('persona_campaigns')
        .insert(campaignIds.map(cid => ({ persona_id: personaId, campaign_id: cid })))

      if (error) {
        console.error('Error assigning campaigns:', error)
        return false
      }
    }

    return true
  } catch (error) {
    console.error('Error in assignPersonaToCampaigns:', error)
    return false
  }
}

/**
 * F0806: Get default persona for organization
 */
export async function getDefaultPersona(orgId: string): Promise<Persona | null> {
  const supabase = supabaseAdmin

  try {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_default', true)
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching default persona:', error)
      return null
    }

    return data || null
  } catch (error) {
    console.error('Error in getDefaultPersona:', error)
    return null
  }
}

/**
 * F0806: Set persona as default
 */
export async function setDefaultPersona(personaId: string, orgId: string): Promise<boolean> {
  const supabase = supabaseAdmin

  try {
    // Clear existing default
    await supabase
      .from('personas')
      .update({ is_default: false })
      .eq('org_id', orgId)
      .eq('is_default', true)

    // Set new default
    const { error } = await supabase
      .from('personas')
      .update({ is_default: true })
      .eq('id', personaId)

    if (error) {
      console.error('Error setting default persona:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in setDefaultPersona:', error)
    return false
  }
}

/**
 * F0810: Test webhook
 */
export async function testWebhook(
  webhookUrl: string,
  secret?: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'Test webhook payload' }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (secret) {
      // Add HMAC signature if secret provided
      const crypto = await import('crypto')
      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(testPayload))
        .digest('hex')
      headers['X-Webhook-Signature'] = signature
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    return {
      success: response.ok,
      statusCode: response.status
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * F0816: Create test call for persona
 */
export async function createPersonaTestCall(
  personaId: string,
  fromNumber: string
): Promise<{ id: string; callSid?: string; error?: string }> {
  const supabase = supabaseAdmin

  try {
    // Create test call record
    const { data, error } = await supabase
      .from('persona_test_calls')
      .insert({
        persona_id: personaId,
        from_number: fromNumber,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating test call:', error)
      return { id: '', error: error.message }
    }

    // TODO: Initiate actual call via Vapi
    // This would call the Vapi API to make an outbound call

    return { id: data.id }
  } catch (error) {
    console.error('Error in createPersonaTestCall:', error)
    return {
      id: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * F0816: Get test call status
 */
export async function getPersonaTestCall(testCallId: string) {
  const supabase = supabaseAdmin

  try {
    const { data, error } = await supabase
      .from('persona_test_calls')
      .select('*')
      .eq('id', testCallId)
      .single()

    if (error) {
      console.error('Error fetching test call:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in getPersonaTestCall:', error)
    return null
  }
}

/**
 * Validate persona configuration
 */
export function validatePersonaConfig(persona: Partial<Persona>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!persona.name || persona.name.trim() === '') {
    errors.push('Persona name is required')
  }

  if (!persona.voice_id || persona.voice_id.trim() === '') {
    errors.push('Voice selection is required')
  }

  if (!persona.system_prompt || persona.system_prompt.trim() === '') {
    errors.push('System prompt is required')
  }

  if (!persona.first_message || persona.first_message.trim() === '') {
    errors.push('First message is required')
  }

  if (persona.max_call_duration_minutes && persona.max_call_duration_minutes < 1) {
    errors.push('Max call duration must be at least 1 minute')
  }

  if (persona.silence_timeout_seconds && persona.silence_timeout_seconds < 1) {
    errors.push('Silence timeout must be at least 1 second')
  }

  if (persona.webhook_url && !isValidUrl(persona.webhook_url)) {
    errors.push('Invalid webhook URL')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Get prompt template variables for display
 */
export function getPromptTemplateVariables(): PersonaVariable[] {
  return [
    {
      name: '{{contact.name}}',
      description: 'Contact first name',
      example_value: 'John',
      category: 'contact'
    },
    {
      name: '{{contact.phone}}',
      description: 'Contact phone number',
      example_value: '+1-555-0123',
      category: 'contact'
    },
    {
      name: '{{contact.company}}',
      description: 'Contact company name',
      example_value: 'ACME Corp',
      category: 'contact'
    },
    {
      name: '{{contact.industry}}',
      description: 'Contact industry',
      example_value: 'Technology',
      category: 'contact'
    },
    {
      name: '{{call.duration}}',
      description: 'Call duration in seconds',
      example_value: '120',
      category: 'call'
    },
    {
      name: '{{call.status}}',
      description: 'Call status',
      example_value: 'in-progress',
      category: 'call'
    },
    {
      name: '{{campaign.name}}',
      description: 'Campaign name',
      example_value: 'Q1 Outreach',
      category: 'campaign'
    },
    {
      name: '{{campaign.type}}',
      description: 'Campaign type',
      example_value: 'sales',
      category: 'campaign'
    },
    {
      name: '{{system.time}}',
      description: 'Current time',
      example_value: '14:30',
      category: 'system'
    },
    {
      name: '{{system.date}}',
      description: 'Current date',
      example_value: '2024-03-27',
      category: 'system'
    }
  ]
}
