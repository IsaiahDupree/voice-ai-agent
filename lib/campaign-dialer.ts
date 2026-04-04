import { supabaseAdmin } from './supabase'
import { startCall } from './vapi'
import { generateWhisperOverrides, CallWhisperContext } from './call-whisper'
import { checkDNC } from './campaign-helpers'
import { isWithinBusinessHours } from './business-hours'
import { checkRateLimit } from './campaign-rate-limit'
import { hasRecentInteraction, isInCooldown, logCampaignAction } from './campaign-audit'

// F0139: Campaign dialer with automatic call whisper context
// F0185: Batch dial implementation
// F0191: Outbound calling hours enforcement
// F0192: Day-of-week restrictions

export interface CampaignDialerOptions {
  campaignId: string
  maxConcurrentCalls?: number
  callDelay?: number // milliseconds between calls
  respectBusinessHours?: boolean
}

export async function processCampaignBatch(options: CampaignDialerOptions) {
  const {
    campaignId,
    maxConcurrentCalls = 5,
    callDelay = 2000,
    respectBusinessHours = true,
  } = options

  // Get campaign details
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('voice_agent_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (campaignError || !campaign) {
    throw new Error(`Campaign not found: ${campaignId}`)
  }

  if (campaign.status !== 'active') {
    throw new Error(`Campaign is not active: ${campaign.status}`)
  }

  // F0263: Check campaign end date - stop if past end date
  if (campaign.scheduled_end_at) {
    const endDate = new Date(campaign.scheduled_end_at)
    const now = new Date()

    if (now > endDate) {
      console.log(`Campaign ${campaignId}: Past end date (${campaign.scheduled_end_at})`)

      // Auto-stop campaign
      await supabaseAdmin
        .from('voice_agent_campaigns')
        .update({ status: 'completed' })
        .eq('id', campaignId)

      // Log campaign completion
      await logCampaignAction({
        campaign_id: parseInt(campaignId, 10),
        action: 'stopped',
        actor: 'system',
        metadata: { reason: 'reached_end_date', end_date: campaign.scheduled_end_at },
        timestamp: now.toISOString()
      })

      return { skipped: true, reason: 'campaign_ended' }
    }
  }

  // F0225: Check rate limit
  const rateStatus = await checkRateLimit(parseInt(campaignId, 10))
  if (!rateStatus.can_dial) {
    console.log(`Campaign ${campaignId}: Rate limit exceeded (${rateStatus.calls_in_last_hour}/${rateStatus.max_calls_per_hour})`)
    return {
      skipped: true,
      reason: 'rate_limit_exceeded',
      wait_until: rateStatus.wait_until,
    }
  }

  // F0191: Check business hours if enabled
  if (respectBusinessHours && campaign.calling_hours_enabled) {
    const businessHours = campaign.calling_hours || {
      timezone: 'America/New_York',
      hours: {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' },
      },
    }

    if (!isWithinBusinessHours(businessHours)) {
      console.log(`Campaign ${campaignId}: Outside calling hours`)
      return { skipped: true, reason: 'outside_calling_hours' }
    }
  }

  // F0192: Check day-of-week restrictions
  if (campaign.calling_days && campaign.calling_days.length > 0) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const today = dayNames[new Date().getDay()]

    if (!campaign.calling_days.includes(today)) {
      console.log(`Campaign ${campaignId}: Not a calling day (${today})`)
      return { skipped: true, reason: 'restricted_day' }
    }
  }

  // Get pending contacts (not yet called or need retry)
  const { data: contacts, error: contactsError } = await supabaseAdmin
    .from('voice_agent_campaign_contacts')
    .select('*, contact:voice_agent_contacts(*)')
    .eq('campaign_id', campaignId)
    .in('status', ['pending', 'retry'])
    .lt('attempt_count', campaign.max_retry_attempts || 3)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(maxConcurrentCalls)

  if (contactsError || !contacts || contacts.length === 0) {
    console.log(`Campaign ${campaignId}: No contacts to dial`)
    return { dialed: 0, message: 'No pending contacts' }
  }

  const results = {
    dialed: 0,
    skipped: 0,
    failed: 0,
    errors: [] as any[],
  }

  for (const campaignContact of contacts) {
    try {
      const contact = campaignContact.contact

      // F0194: DNC list check - skip if on DNC list
      const isDNC = await checkDNC(contact.phone)
      if (isDNC) {
        console.log(`Skipping DNC number: ${contact.phone}`)
        await supabaseAdmin
          .from('voice_agent_campaign_contacts')
          .update({
            status: 'dnc',
            updated_at: new Date().toISOString(),
          })
          .eq('id', campaignContact.id)

        results.skipped++
        continue
      }

      // F0250: Skip if contact had recent interaction (last 24h)
      if (await hasRecentInteraction(contact.id, 24)) {
        console.log(`Skipping contact ${contact.id}: recent interaction`)
        results.skipped++
        continue
      }

      // F0261: Check campaign cooldown period
      if (await isInCooldown(parseInt(campaignId, 10), contact.id, 24)) {
        console.log(`Skipping contact ${contact.id}: in cooldown period`)
        results.skipped++
        continue
      }

      // F0139: Generate call whisper context for this contact
      const whisperContext: CallWhisperContext = {
        contactName: contact.name,
        contactCompany: contact.company,
        specialNotes: contact.notes,
      }

      // Add campaign-specific context
      if (campaign.script_context) {
        whisperContext.customFields = {
          campaign_context: campaign.script_context,
          campaign_name: campaign.name,
        }
      }

      // Add call reason if specified
      if (campaignContact.call_reason) {
        whisperContext.callReason = campaignContact.call_reason
      }

      // Generate assistant overrides with whisper
      const assistantOverrides = generateWhisperOverrides(whisperContext)

      // F0241: Agent script for outbound - use campaign-specific script/prompt
      if (campaign.outbound_script) {
        if (!assistantOverrides.model) {
          assistantOverrides.model = {
            provider: 'openai',
            model: 'gpt-4o',
            systemPrompt: campaign.outbound_script
          }
        } else {
          assistantOverrides.model.systemPrompt = campaign.outbound_script
        }
      }

      // Add campaign-specific overrides
      if (campaign.assistant_overrides) {
        Object.assign(assistantOverrides, campaign.assistant_overrides)
      }

      // F0139: Initiate call with whisper context loaded before first word
      const call = await startCall({
        assistantId: campaign.assistant_id,
        phoneNumberId: campaign.phone_number_id,
        customerNumber: contact.phone,
        assistantOverrides,
        metadata: {
          campaign_id: campaignId,
          campaign_contact_id: campaignContact.id,
          contact_id: contact.id,
          whisper_context: whisperContext,
        },
      })

      // F0259: Update campaign contact status with callId stored
      await supabaseAdmin
        .from('voice_agent_campaign_contacts')
        .update({
          status: 'calling',
          attempt_count: campaignContact.attempt_count + 1,
          last_call_id: call.id, // F0259: Store Vapi callId
          last_attempted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignContact.id)

      // Log call in calls table
      await supabaseAdmin.from('voice_agent_calls').insert({
        call_id: call.id,
        assistant_id: campaign.assistant_id,
        campaign_id: campaignId,
        contact_id: contact.id,
        status: 'queued',
        started_at: new Date().toISOString(),
        from_number: campaign.phone_number_id,
        to_number: contact.phone,
        direction: 'outbound',
        metadata: {
          whisper_context: whisperContext,
          campaign_contact_id: campaignContact.id,
          attempt_number: campaignContact.attempt_count + 1,
        },
      })

      results.dialed++

      // Delay between calls
      if (callDelay > 0 && results.dialed < contacts.length) {
        await new Promise(resolve => setTimeout(resolve, callDelay))
      }
    } catch (error: any) {
      console.error(`Error dialing contact ${campaignContact.id}:`, error)
      results.failed++
      results.errors.push({
        contact_id: campaignContact.id,
        error: error.message,
      })

      // Mark as failed
      await supabaseAdmin
        .from('voice_agent_campaign_contacts')
        .update({
          status: 'failed',
          metadata: {
            last_error: error.message,
            failed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignContact.id)
    }
  }

  return results
}

// F0187: Campaign pause/resume
// F0254: With audit logging
export async function pauseCampaign(campaignId: string) {
  const { data, error } = await supabaseAdmin
    .from('voice_agent_campaigns')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single()

  if (error) throw error

  // F0254: Log campaign pause action
  await logCampaignAction({
    campaign_id: parseInt(campaignId, 10),
    action: 'paused',
    timestamp: new Date().toISOString(),
  })

  return data
}

export async function resumeCampaign(campaignId: string) {
  const { data, error } = await supabaseAdmin
    .from('voice_agent_campaigns')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single()

  if (error) throw error

  // F0254: Log campaign resume action
  await logCampaignAction({
    campaign_id: parseInt(campaignId, 10),
    action: 'resumed',
    timestamp: new Date().toISOString(),
  })

  return data
}
