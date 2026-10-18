/**
 * Persona materialization.
 *
 * On install, derive a Vapi assistant config from the pack's
 * default_voice_profile + tool_subset + compliance disclosures, plus
 * tenant kb_values for first-message personalization. The assistant is
 * created in Vapi and its id is persisted on tenant_pack_installs.
 *
 * If VAPI_API_KEY is missing, materialization is skipped silently and
 * the install proceeds without an assistant_id (so packs still install
 * in dev / test environments).
 */

import { createAssistant, updateAssistant, type VapiAssistant, type VapiFunctionTool } from '../vapi'
import { supabaseAdmin } from '../supabase'

interface VoiceProfile {
  voice_id?: string
  temperature?: number
  warmth?: number
  speaking_rate?: number
  persona_prompt?: string
  guardrails?: string[]
}

interface ComplianceProfile {
  slug?: string
  required_disclosures?: string[]
  blocked_phrases?: string[]
  flags?: Record<string, unknown>
}

export interface MaterializeInput {
  installId: string
  tenantId: string
  packSlug: string
  packName: string
  toolSubset: string[]
  voiceProfile: VoiceProfile
  compliance: ComplianceProfile
  kbValues: Record<string, unknown>
}

export async function materializePersona(input: MaterializeInput): Promise<string | null> {
  if (!process.env.VAPI_API_KEY) return null

  const config = buildAssistantConfig(input)

  // If install already has an assistant, update in place; else create.
  const { data: existing } = await supabaseAdmin
    .from('tenant_pack_installs')
    .select('assistant_id')
    .eq('id', input.installId)
    .maybeSingle()

  let assistantId: string | null = (existing as any)?.assistant_id ?? null

  try {
    if (assistantId) {
      await updateAssistant(assistantId, config)
    } else {
      const created = await createAssistant(config)
      assistantId = created?.id ?? null
    }
  } catch (e) {
    console.error('[packs] persona materialization failed:', e)
    return null
  }

  if (assistantId) {
    await supabaseAdmin
      .from('tenant_pack_installs')
      .update({ assistant_id: assistantId, updated_at: new Date().toISOString() })
      .eq('id', input.installId)
  }

  return assistantId
}

export function buildAssistantConfig(input: MaterializeInput): VapiAssistant {
  const { voiceProfile, compliance, kbValues, packSlug } = input

  const businessName =
    (kbValues.business_name as string | undefined) ?? input.packName ?? 'our team'
  const disclosures = (compliance.required_disclosures ?? []).join(' ')
  const blocked = compliance.blocked_phrases ?? []
  const guardrails = voiceProfile.guardrails ?? []

  const systemPrompt = [
    voiceProfile.persona_prompt?.trim() ?? '',
    disclosures ? `\nRequired disclosures (use verbatim when relevant): ${disclosures}` : '',
    blocked.length ? `\nNever say: ${blocked.map(b => `"${b}"`).join(', ')}.` : '',
    guardrails.length ? `\nGuardrails:\n- ${guardrails.join('\n- ')}` : '',
    `\nBusiness: ${businessName}.`,
  ]
    .filter(Boolean)
    .join('\n')
    .trim()

  const firstMessage =
    (kbValues.greeting as string | undefined) ??
    `Thanks for calling ${businessName}. How can I help you today?`

  const tools: VapiFunctionTool[] = input.toolSubset.map(name => toolStub(name))

  return {
    name: `[${packSlug}] ${businessName}`,
    model: {
      provider: 'anthropic',
      model: 'claude-opus-4-7',
      systemPrompt,
      temperature: voiceProfile.temperature ?? 0.5,
      tools,
    },
    voice: {
      provider: 'elevenlabs',
      voiceId: voiceProfile.voice_id ?? 'rachel',
      speed: voiceProfile.speaking_rate ?? 1.0,
    },
    firstMessage,
    metadata: {
      pack_install_id: input.installId,
      pack_slug: packSlug,
      tenant_id: input.tenantId,
      compliance_profile: compliance.slug,
    },
    hipaaEnabled: !!compliance.flags?.hipaa,
    recordingEnabled: true,
    tags: [`pack:${packSlug}`, `tenant:${input.tenantId}`],
  }
}

/**
 * Tool stubs the assistant exposes. The webhook (runPackTool) is what
 * actually executes them; here we only need the function-calling
 * declaration so the LLM knows it can invoke them.
 */
function toolStub(name: string): VapiFunctionTool {
  const params: Record<string, any> = {
    checkCalendar: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD' },
        eventTypeId: { type: 'string' },
      },
      required: ['date'],
    },
    bookAppointment: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        date: { type: 'string' },
        time: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['name', 'phone', 'date', 'time'],
    },
    sendSMS: {
      type: 'object',
      properties: { to: { type: 'string' }, body: { type: 'string' } },
      required: ['to', 'body'],
    },
    lookupContact: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        create_if_new: { type: 'boolean' },
        name: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['phone'],
    },
    transferCall: {
      type: 'object',
      properties: { destination: { type: 'string' }, reason: { type: 'string' } },
      required: ['destination'],
    },
    endCall: { type: 'object', properties: {} },
    escalateEmergency: {
      type: 'object',
      properties: {
        symptom: { type: 'string', description: 'Symptom or red flag verbatim' },
        petName: { type: 'string' },
        callerPhone: { type: 'string' },
      },
      required: ['symptom'],
    },
    createRefillRequest: {
      type: 'object',
      properties: {
        petName: { type: 'string' },
        medication: { type: 'string' },
        lastFillDate: { type: 'string' },
        ownerPhone: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['petName', 'medication', 'ownerPhone'],
    },
    flagAllergenAndTransfer: {
      type: 'object',
      properties: { allergen: { type: 'string' }, partySize: { type: 'number' } },
      required: ['allergen'],
    },
    lifeSafetyInterrupt: {
      type: 'object',
      properties: { hazard: { type: 'string' } },
      required: ['hazard'],
    },
    verifyInsurance: {
      type: 'object',
      properties: {
        carrier: { type: 'string' },
        memberId: { type: 'string' },
        dob: { type: 'string', description: 'YYYY-MM-DD' },
        relationship: { type: 'string', enum: ['self', 'spouse', 'child'] },
      },
      required: ['carrier', 'memberId', 'dob'],
    },
    conflictCheck: {
      type: 'object',
      properties: {
        callerFullName: { type: 'string' },
        callerDobOrAddress: { type: 'string' },
        opposingPartyName: { type: 'string' },
        otherParties: { type: 'array', items: { type: 'string' } },
        matterState: { type: 'string' },
      },
      required: ['callerFullName'],
    },
    createIntakeRecord: {
      type: 'object',
      properties: {
        callerFullName: { type: 'string' },
        callerPhone: { type: 'string' },
        callerEmail: { type: 'string' },
        matterState: { type: 'string' },
        practiceArea: { type: 'string' },
        incidentSummary: { type: 'string' },
        incidentDate: { type: 'string' },
        urgentReview: { type: 'boolean' },
        conflictCheckId: { type: 'string' },
      },
      required: [
        'callerFullName',
        'callerPhone',
        'matterState',
        'practiceArea',
        'incidentSummary',
        'conflictCheckId',
      ],
    },
    verifyConsent: {
      type: 'object',
      properties: {
        callerPhone: { type: 'string' },
        channel: { type: 'string', enum: ['inbound', 'outbound'] },
      },
      required: ['callerPhone', 'channel'],
    },
    stage5of6Application: {
      type: 'object',
      properties: {
        fullName: { type: 'string' },
        annualIncomeCents: { type: 'number' },
        propertyAddress: { type: 'string' },
        estimatedValueCents: { type: 'number' },
        loanAmountCents: { type: 'number' },
        matterState: { type: 'string' },
        productType: { type: 'string' },
        sensitive_volunteered: { type: 'boolean' },
      },
      required: [
        'fullName',
        'annualIncomeCents',
        'propertyAddress',
        'estimatedValueCents',
        'loanAmountCents',
        'matterState',
        'productType',
      ],
    },
    escalateToMLO: {
      type: 'object',
      properties: {
        matterState: { type: 'string' },
        productType: { type: 'string' },
        applicationId: { type: 'string' },
        callerPhone: { type: 'string' },
        callerName: { type: 'string' },
      },
      required: ['matterState', 'productType', 'callerPhone', 'callerName'],
    },
    searchInventory: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-form caller phrasing' },
        year: { type: 'number' },
        make: { type: 'string' },
        model: { type: 'string' },
        maxPriceCents: { type: 'number' },
        limit: { type: 'number', description: 'Max vehicles to return (1–10)' },
      },
    },
    bookTestDrive: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        vin: { type: 'string', description: 'Must come from searchInventory — never invent' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:MM 24h' },
        salespersonId: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['name', 'phone', 'email', 'vin', 'date', 'time'],
    },
    bookServiceAppointment: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        vin: { type: 'string' },
        serviceType: {
          type: 'string',
          description: 'oil_change | diagnostic | tire_rotation | recall | maintenance | other',
        },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:MM 24h' },
        advisorId: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['name', 'phone', 'serviceType', 'date', 'time'],
    },
    createSalesLead: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        department: {
          type: 'string',
          enum: ['sales', 'service', 'parts', 'finance', 'trade', 'fleet'],
        },
        vehicleOfInterest: { type: 'string' },
        leadSource: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['name', 'phone', 'department'],
    },
    escalateToFinance: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'payment_quote | apr_quote | lock_request | otd_negotiation | lease_question',
        },
        callerPhone: { type: 'string' },
        callerName: { type: 'string' },
        vehicleOfInterest: { type: 'string' },
      },
      required: ['reason', 'callerPhone', 'callerName'],
    },
    escalateToAppraiser: {
      type: 'object',
      properties: {
        vehicleYear: { type: 'number' },
        make: { type: 'string' },
        model: { type: 'string' },
        mileage: { type: 'number' },
        condition: { type: 'string' },
        vin: { type: 'string' },
        callerPhone: { type: 'string' },
        callerName: { type: 'string' },
      },
      required: ['vehicleYear', 'make', 'model', 'mileage', 'callerPhone', 'callerName'],
    },
    logRecallInquiry: {
      type: 'object',
      properties: {
        vin: { type: 'string' },
        callerPhone: { type: 'string' },
        callerName: { type: 'string' },
        recallCampaign: { type: 'string' },
      },
      required: ['vin', 'callerPhone'],
    },
    queryRND: {
      type: 'object',
      properties: { phone: { type: 'string' } },
      required: ['phone'],
    },
    scrubDNC: {
      type: 'object',
      properties: { phone: { type: 'string' }, state: { type: 'string' } },
      required: ['phone'],
    },
    checkCarrierAppointment: {
      type: 'object',
      properties: {
        carrier: { type: 'string' },
        state: { type: 'string', description: 'Two-letter postal code' },
        lob: {
          type: 'string',
          description:
            'personal_auto | home | commercial_bop | medicare_ma | medicare_pdp | life | etc.',
        },
      },
      required: ['carrier', 'state', 'lob'],
    },
    checkProducerLicense: {
      type: 'object',
      properties: {
        state: { type: 'string' },
        lob: { type: 'string' },
      },
      required: ['state', 'lob'],
    },
    captureSOA: {
      type: 'object',
      properties: {
        fullName: { type: 'string' },
        address: { type: 'string' },
        phone: { type: 'string' },
        productsToDiscuss: {
          type: 'array',
          items: { type: 'string' },
          description: 'e.g. ["MA","MAPD","PDP","Medigap","DSNP"]',
        },
        agentName: { type: 'string' },
        agentNpn: { type: 'string' },
        attestationVerbal: {
          type: 'boolean',
          description: 'Did the caller verbally attest? Required true to capture.',
        },
        callerInitiated: { type: 'boolean' },
        enrollmentPeriod: {
          type: 'string',
          enum: ['AEP', 'OEP', 'ICEP', 'IEP', 'SEP', 'none'],
        },
      },
      required: [
        'fullName',
        'address',
        'phone',
        'productsToDiscuss',
        'agentName',
        'agentNpn',
        'attestationVerbal',
      ],
    },
    logTPMODisclaimer: {
      type: 'object',
      properties: {
        spokenAt: { type: 'string', description: 'ISO timestamp the disclaimer began' },
        transcriptOffsetMs: { type: 'number' },
        placement: {
          type: 'string',
          enum: ['before_benefits', 'first_minute'],
        },
        carrierCount: { type: 'number' },
        productCount: { type: 'number' },
      },
    },
  }

  const descriptions: Record<string, string> = {
    checkCalendar: 'Check calendar availability for a date',
    bookAppointment: 'Book an appointment for a caller',
    sendSMS: 'Send an SMS message to a caller',
    lookupContact: 'Look up a caller in the CRM by phone',
    transferCall: 'Transfer the call to a human destination',
    endCall: 'End the current call',
    escalateEmergency: 'Escalate a veterinary emergency to the on-call team',
    createRefillRequest: 'Queue a medication refill request for clinic team',
    flagAllergenAndTransfer:
      'Caller asked an allergen-safety question; flag and transfer to staff. Never confirm safety.',
    lifeSafetyInterrupt:
      'Caller reports gas smell, CO, electrical fire, etc. Route to 911/utility before scheduling.',
    verifyInsurance:
      'Run dental insurance eligibility (Stedi 270/271). Quote returned coverage verbatim — never estimate or interpret.',
    conflictCheck:
      "Pre-intake conflict check against the firm's PMS. Run BEFORE collecting case facts. Never reveal the reason for a conflict.",
    createIntakeRecord:
      'Persist a legal-intake record (only after conflictCheck passes). Tag urgent_review when applicable.',
    verifyConsent:
      'Verify TCPA consent artifact for outbound mortgage callbacks. Generic marketing-partner consent is insufficient under HBPPA.',
    stage5of6Application:
      'Stage a TRID 5-of-6 mortgage application (NEVER SSN). If caller volunteers SSN, set sensitive_volunteered: true.',
    escalateToMLO:
      'Hand off to a state-licensed Mortgage Loan Officer. Returns the matched MLO name + NMLS id.',
    searchInventory:
      "Search the dealer's approved inventory feed. ONLY quote vehicles that come back from this — never invent VINs, prices, or trims.",
    bookTestDrive:
      'Book a test drive for a specific VIN returned by searchInventory. Calendar provider records vin + salespersonId in metadata.',
    bookServiceAppointment:
      'Book a service appointment (oil change, diagnostic, tire, recall, maintenance). Picks the matched advisor and bay.',
    createSalesLead:
      'Persist the caller as a CRM lead with department + vehicleOfInterest. Default leadSource: "AI Voice Assistant".',
    escalateToFinance:
      'Hand off any payment / APR / lock / OTD-negotiation request to the finance manager. Never quote payment or APR yourself.',
    escalateToAppraiser:
      'Hand off a trade-in to a human appraiser. Trade tools give a RANGE; the appraiser gives the number.',
    logRecallInquiry:
      'Log a VIN-keyed recall inquiry and route the caller to a service advisor.',
    queryRND:
      'Query the FCC Reassigned Numbers Database for an outbound dial. Cached 24h. Do NOT proceed if reassigned=true.',
    scrubDNC:
      'Scrub a phone against federal + state + internal DNC. Honor opt-outs immediately. Do NOT proceed if blocked=true.',
    checkCarrierAppointment:
      "Confirm the agency is appointed with this carrier in the caller's state for the requested LOB. Decline honestly if not.",
    checkProducerLicense:
      "Confirm a licensed producer of record exists for state × LOB before any quote-intake. Don't solicit insurance without one.",
    captureSOA:
      'Capture Medicare Scope of Appointment BEFORE discussing plan benefits. Pre-Oct-1-2026 the 48-hour wait applies unless caller-initiated or AEP/OEP/ICEP/SEP last-4-days.',
    logTPMODisclaimer:
      'Log the TPMO disclaimer reading (placement: before_benefits per CY2026 final rule). Required before discussing MA/MAPD/PDP benefits.',
  }

  return {
    type: 'function',
    function: {
      name,
      description: descriptions[name] ?? `Pack tool: ${name}`,
      parameters: params[name] ?? { type: 'object', properties: {} },
    },
    async: true,
  }
}
