/**
 * LocalReach V3 — Autonomous Calling Engine
 * Finds the next business to call, runs compliance checks,
 * builds a dynamic call script, and initiates the Vapi call.
 */
import { supabaseAdmin } from '../supabase'
import { startCall } from '../vapi'
import type { VapiFunctionTool, VapiCall } from '../vapi'
import { checkCompliance } from './compliance'
import { matchOffers, getDefaultOffers } from './offer-matcher'
import { getBusinessesInRing, getCurrentQuarter, getQuarterRingIndex } from './geo-spiral'
import { checkSuppressionWindow } from './geo-spiral'
import type {
  LocalReachBusiness,
  LocalReachCampaign,
  BusinessResearch,
  LocalReachOffer,
  CallAttempt,
  Objection,
} from './types'

const MAX_DAILY_CALLS = 100
const MAX_ATTEMPTS_PER_BUSINESS = 3

/**
 * Find the next un-called business, run compliance, and initiate a Vapi call.
 * Returns the call attempt record or null if no business is available.
 */
export async function dialNextBusiness(
  campaignId: string
): Promise<CallAttempt | null> {
  // 1. Fetch campaign
  const { data: campaign, error: campError } = await supabaseAdmin
    .from('localreach_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (campError || !campaign) {
    throw new Error(`Campaign ${campaignId} not found: ${campError?.message}`)
  }

  const camp = campaign as LocalReachCampaign

  // Check campaign is active
  if (camp.status !== 'active') {
    console.log(`Campaign ${campaignId} is ${camp.status}, skipping`)
    return null
  }

  // Enforce daily quota
  if (camp.calls_today >= (camp.daily_call_quota || MAX_DAILY_CALLS)) {
    console.log(`Campaign ${campaignId} hit daily quota: ${camp.calls_today}/${camp.daily_call_quota}`)
    return null
  }

  // Enforce calling hours
  const { isWithinCallingHours } = await import('./compliance')
  if (!isWithinCallingHours(camp.timezone || 'America/New_York')) {
    console.log(`Campaign ${campaignId}: outside calling hours for ${camp.timezone}`)
    return null
  }

  // 2. Find next business in current ring
  const quarter = getCurrentQuarter()
  const ringIndex = camp.current_ring_index ?? getQuarterRingIndex(quarter)

  const businesses = await getBusinessesInRing(campaignId, ringIndex)

  let targetBusiness: LocalReachBusiness | null = null

  for (const biz of businesses) {
    // Skip businesses that have been called too many times
    if (biz.call_attempts >= MAX_ATTEMPTS_PER_BUSINESS) continue

    // Skip if in suppression window
    const suppressed = await checkSuppressionWindow(biz.id)
    if (suppressed) continue

    // Skip if next_call_after is in the future
    if (biz.next_call_after && new Date(biz.next_call_after) > new Date()) continue

    targetBusiness = biz
    break
  }

  if (!targetBusiness) {
    console.log(`Campaign ${campaignId}: no available businesses in ring ${ringIndex}`)
    return null
  }

  // 3. Run compliance checks
  const complianceResult = await checkCompliance(
    targetBusiness.phone_e164,
    targetBusiness.id,
    camp.timezone || 'America/New_York'
  )

  if (!complianceResult.allowed) {
    console.log(`Compliance blocked for ${targetBusiness.name}: ${complianceResult.reason}`)

    // Record the blocked attempt
    const blockedAttempt = await recordCallAttempt({
      campaign_id: campaignId,
      business_id: targetBusiness.id,
      offer_id: null,
      vapi_call_id: null,
      phone_dialed: targetBusiness.phone_e164,
      status: 'failed',
      outcome: null,
      duration_seconds: null,
      recording_url: null,
      transcript: null,
      sentiment_score: null,
      objections_encountered: [],
      sms_sent: false,
      sms_content: null,
      compliance_checks_passed: false,
      ring_index: ringIndex,
      attempt_number: targetBusiness.call_attempts + 1,
      cost_cents: null,
    })

    return blockedAttempt
  }

  // 4. Fetch research and match offers
  const { data: research } = await supabaseAdmin
    .from('localreach_business_research')
    .select('*')
    .eq('business_id', targetBusiness.id)
    .single()

  let offers: LocalReachOffer[] = []

  if (targetBusiness.assigned_offer_id) {
    // Use pre-assigned offer
    const { data: assignedOffer } = await supabaseAdmin
      .from('localreach_offers')
      .select('*')
      .eq('id', targetBusiness.assigned_offer_id)
      .single()

    if (assignedOffer) {
      offers = [assignedOffer as LocalReachOffer]
    }
  }

  if (offers.length === 0) {
    // Match offers based on research
    const { data: allOffers } = await supabaseAdmin
      .from('localreach_offers')
      .select('*')
      .eq('active', true)
      .order('sort_order')

    const availableOffers = (allOffers as LocalReachOffer[]) || getDefaultOffers()

    if (research) {
      const matched = matchOffers(research as BusinessResearch, availableOffers)
      offers = matched.map((m) => m.offer)
    } else {
      // No research — use first universal offer
      offers = availableOffers.filter((o) => o.niche_tags.includes('all')).slice(0, 1)
    }
  }

  const primaryOffer = offers[0] || getDefaultOffers()[0]

  // 5. Fetch objection handlers
  const { data: objections } = await supabaseAdmin
    .from('localreach_objections')
    .select('*')
    .eq('active', true)
    .or(`campaign_id.eq.${campaignId},campaign_id.is.null`)
    .order('success_rate', { ascending: false })

  // 6. Build call script
  const systemPrompt = buildCallScript(
    targetBusiness,
    research as BusinessResearch | null,
    primaryOffer,
    (objections as Objection[]) || []
  )

  // 7. Initiate Vapi call
  let vapiCall: VapiCall

  try {
    vapiCall = await startCall({
      assistantId: camp.vapi_assistant_id || '',
      phoneNumberId: camp.vapi_phone_number_id || undefined,
      customerNumber: targetBusiness.phone_e164,
      assistantOverrides: {
        name: `LocalReach-${camp.name}-${targetBusiness.name}`,
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          systemPrompt,
          tools: getVapiToolDefinitions(),
          temperature: 0.7,
          maxTokens: 1000,
        },
        voice: {
          provider: 'elevenlabs',
          voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam — professional male voice
          stability: 0.6,
          similarityBoost: 0.8,
        },
        firstMessage: `Hi, is this ${targetBusiness.name}?`,
        maxDurationSeconds: 300,
        silenceTimeoutSeconds: 30,
        voicemailDetectionEnabled: true,
        voicemailMessage: `Hi, this is a quick message for ${targetBusiness.name}. I help local ${targetBusiness.niche} businesses automate their phone systems and never miss a lead. I'd love to show you how. I'll send a text with my info. Have a great day!`,
        metadata: {
          campaign_id: campaignId,
          business_id: targetBusiness.id,
          offer_id: primaryOffer.id,
          ring_index: ringIndex,
        },
      },
    })
  } catch (callError: unknown) {
    const errorMessage = callError instanceof Error ? callError.message : String(callError)
    console.error(`Failed to initiate call to ${targetBusiness.name}:`, errorMessage)

    const failedAttempt = await recordCallAttempt({
      campaign_id: campaignId,
      business_id: targetBusiness.id,
      offer_id: primaryOffer.id,
      vapi_call_id: null,
      phone_dialed: targetBusiness.phone_e164,
      status: 'failed',
      outcome: null,
      duration_seconds: null,
      recording_url: null,
      transcript: null,
      sentiment_score: null,
      objections_encountered: [],
      sms_sent: false,
      sms_content: null,
      compliance_checks_passed: true,
      ring_index: ringIndex,
      attempt_number: targetBusiness.call_attempts + 1,
      cost_cents: null,
    })

    return failedAttempt
  }

  // 8. Record the call attempt
  const attempt = await recordCallAttempt({
    campaign_id: campaignId,
    business_id: targetBusiness.id,
    offer_id: primaryOffer.id,
    vapi_call_id: vapiCall.id,
    phone_dialed: targetBusiness.phone_e164,
    status: 'initiated',
    outcome: null,
    duration_seconds: null,
    recording_url: null,
    transcript: null,
    sentiment_score: null,
    objections_encountered: [],
    sms_sent: false,
    sms_content: null,
    compliance_checks_passed: true,
    ring_index: ringIndex,
    attempt_number: targetBusiness.call_attempts + 1,
    cost_cents: null,
  })

  // 9. Update business and campaign counters
  await supabaseAdmin
    .from('localreach_businesses')
    .update({
      status: 'called',
      call_attempts: targetBusiness.call_attempts + 1,
      last_called_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetBusiness.id)

  await supabaseAdmin
    .from('localreach_campaigns')
    .update({
      calls_today: camp.calls_today + 1,
      total_calls: camp.total_calls + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)

  return attempt
}

/**
 * Build the system prompt for the Vapi AI agent.
 */
export function buildCallScript(
  business: LocalReachBusiness,
  research: BusinessResearch | null,
  offer: LocalReachOffer,
  objections: Objection[]
): string {
  const businessContext = research
    ? `
Business Summary: ${research.summary || 'N/A'}
Services: ${research.services?.join(', ') || 'N/A'}
Pain Points: ${research.pain_points?.join(', ') || 'N/A'}
Has Online Booking: ${research.has_online_booking ? 'Yes' : 'No'}
Has Chat Widget: ${research.has_chat_widget ? 'Yes' : 'No'}
Has Review System: ${research.has_reviews_system ? 'Yes' : 'No'}
`
    : `Business Type: ${business.niche}\nLocation: ${business.city || ''}, ${business.state || ''}`

  const objectionHandlers = objections
    .slice(0, 8)
    .map((o) => `If they say "${o.trigger_phrase}" → ${o.response_script}`)
    .join('\n')

  return `You are a friendly, professional AI sales representative for an AI automation agency.
You are calling ${business.name}, a local ${business.niche} business.

YOUR GOAL: Book a 15-minute demo call on the calendar. Secondary goal: get them to agree to receive a payment link for a trial.

BUSINESS CONTEXT:
${businessContext}

OFFER TO PRESENT:
Name: ${offer.name}
Price: $${(offer.price_cents / 100).toFixed(0)}/mo
Pitch: ${offer.elevator_pitch}
Key Features:
${offer.features.map((f) => `- ${f}`).join('\n')}

CALL FLOW:
1. OPENER: Greet by name. Confirm you're speaking with the owner/manager. Be warm but brief.
2. HOOK: Reference something specific about their business (Google reviews, website, location). Connect to a pain point.
3. PITCH: Present the offer in 30 seconds or less. Focus on the specific benefit for THEIR business.
4. HANDLE OBJECTIONS: Use the handlers below. Be empathetic, never pushy.
5. CLOSE: Offer to book a 15-minute demo. Use the checkCalendlySlots tool to offer specific times.
6. FOLLOW-UP: If they're interested but not ready, offer to send info via SMS using sendSMS.
7. EXIT GRACEFULLY: If they say no, thank them and end positively. If they request DNC, immediately stop and confirm removal.

OBJECTION HANDLERS:
${objectionHandlers || 'No specific handlers configured — use general empathy and reframing.'}

RULES:
- Never lie or make claims you can't back up.
- If they say "remove me", "do not call", "stop calling", or "not interested" firmly twice — immediately stop pitching, confirm DNC, and end the call politely.
- Keep the call under 3 minutes unless they're engaged.
- Sound natural — use conversational language, not a script.
- Mirror their energy and pace.
- If you reach voicemail, leave a concise 20-second message and hang up.

AVAILABLE TOOLS:
- checkCalendlySlots: Check available demo times
- bookCalendlySlot: Book a specific demo time
- createStripePaymentLink: Generate a payment link for the offer
- sendSMS: Send a follow-up text with info or links`
}

/**
 * Vapi function tool definitions for in-call actions.
 */
export function getVapiToolDefinitions(): VapiFunctionTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'checkCalendlySlots',
        description: 'Check available calendar slots for booking a demo call. Returns the next 3 available time slots.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      async: true,
      timeoutSeconds: 10,
      messages: [
        { type: 'request-start', content: 'Let me check what times are available for a quick demo...' },
      ],
    },
    {
      type: 'function',
      function: {
        name: 'bookCalendlySlot',
        description: 'Book a specific calendar slot for a demo call with the business.',
        parameters: {
          type: 'object',
          properties: {
            datetime: {
              type: 'string',
              description: 'ISO 8601 datetime for the booking, e.g. 2026-04-07T14:00:00Z',
            },
            businessName: {
              type: 'string',
              description: 'Name of the business being booked',
            },
            phone: {
              type: 'string',
              description: 'Phone number of the person being booked',
            },
          },
          required: ['datetime', 'businessName', 'phone'],
        },
      },
      async: true,
      timeoutSeconds: 15,
      messages: [
        { type: 'request-start', content: 'Great, let me book that for you right now...' },
      ],
    },
    {
      type: 'function',
      function: {
        name: 'createStripePaymentLink',
        description: 'Create a Stripe payment link for the offer being discussed. Returns a URL to send via SMS.',
        parameters: {
          type: 'object',
          properties: {
            offerId: {
              type: 'string',
              description: 'The ID of the offer to create a payment link for',
            },
            businessName: {
              type: 'string',
              description: 'Name of the business for the payment link',
            },
          },
          required: ['offerId', 'businessName'],
        },
      },
      async: true,
      timeoutSeconds: 10,
      messages: [
        { type: 'request-start', content: 'Let me generate a secure payment link for you...' },
      ],
    },
    {
      type: 'function',
      function: {
        name: 'sendSMS',
        description: 'Send a follow-up SMS to the business with relevant information, links, or booking confirmations.',
        parameters: {
          type: 'object',
          properties: {
            phone: {
              type: 'string',
              description: 'Phone number to send SMS to in E.164 format',
            },
            message: {
              type: 'string',
              description: 'The SMS message to send (max 160 characters recommended)',
            },
          },
          required: ['phone', 'message'],
        },
      },
      async: true,
      timeoutSeconds: 10,
      messages: [
        { type: 'request-start', content: "I'll send that over to you right now via text..." },
      ],
    },
  ]
}

// ─── Internal helpers ───

async function recordCallAttempt(
  data: Omit<CallAttempt, 'id' | 'created_at' | 'updated_at'>
): Promise<CallAttempt> {
  const now = new Date().toISOString()

  const { data: inserted, error } = await supabaseAdmin
    .from('localreach_call_attempts')
    .insert({
      ...data,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to record call attempt: ${error.message}`)
  }

  return inserted as CallAttempt
}
