/**
 * Pack-aware function-tool runtime.
 *
 * Thin wrappers over the provider registry that enforce the pack's
 * tool_subset and resolve concrete adapters from the tenant's
 * integration_map. Used by the Vapi webhook handler when a call has a
 * pack context attached; legacy direct-call paths (lib/calcom, lib/sms,
 * etc.) remain untouched.
 */

import {
  resolveCalendar,
  resolveSMS,
  resolveCRM,
  resolvePMS,
  type IntegrationMap,
} from '../providers'
import type { PackContext } from './context'
import { isToolAllowed } from './context'
import { loadCredentialsForInstall, resolveCredentials } from './credentials'

async function credsFor(ctx: PackContext, providerSlug: string) {
  const bag = await loadCredentialsForInstall(ctx.installId).catch(() => ({}))
  return resolveCredentials(providerSlug, bag)
}

function calendarSlug(map: IntegrationMap): string {
  return map.calendar ?? 'cal_com'
}
function smsSlug(map: IntegrationMap): string {
  return map.sms ?? 'twilio'
}
function crmSlug(map: IntegrationMap): string {
  return map.crm ?? 'supabase'
}
function pmsSlug(map: IntegrationMap): string | null {
  return map.pms ?? null
}

export class ToolNotAllowedError extends Error {
  constructor(toolName: string, packSlug: string) {
    super(`Tool "${toolName}" is not in pack "${packSlug}" tool_subset`)
    this.name = 'ToolNotAllowedError'
  }
}

function ensureAllowed(ctx: PackContext, toolName: string): void {
  if (!isToolAllowed(ctx, toolName)) {
    throw new ToolNotAllowedError(toolName, ctx.packSlug)
  }
}

export async function checkCalendar(
  ctx: PackContext,
  params: { date: string; eventTypeId?: string | number },
) {
  ensureAllowed(ctx, 'checkCalendar')
  const cal = resolveCalendar(ctx.integrationMap, await credsFor(ctx, calendarSlug(ctx.integrationMap)))
  const slots = await cal.listSlots({
    date: params.date,
    eventTypeId: params.eventTypeId ?? (ctx.kbValues.default_event_type_id as string | undefined),
  })
  return {
    available: slots.some(s => s.available),
    slots: slots.filter(s => s.available).map(s => s.start),
    count: slots.filter(s => s.available).length,
    provider: cal.slug,
  }
}

export async function bookAppointment(
  ctx: PackContext,
  params: {
    name: string
    email: string
    phone: string
    date: string
    time: string
    eventTypeId?: string | number
    notes?: string
  },
) {
  ensureAllowed(ctx, 'bookAppointment')
  const cal = resolveCalendar(ctx.integrationMap, await credsFor(ctx, calendarSlug(ctx.integrationMap)))
  const startIso = `${params.date}T${params.time.length === 5 ? params.time + ':00' : params.time}`
  const booking = await cal.bookSlot({
    eventTypeId: params.eventTypeId ?? (ctx.kbValues.default_event_type_id as string | undefined),
    start: new Date(startIso).toISOString(),
    attendeeName: params.name,
    attendeeEmail: params.email,
    attendeePhone: params.phone,
    notes: params.notes,
    metadata: { tenant_id: ctx.tenantId, pack_slug: ctx.packSlug, install_id: ctx.installId },
  })
  if (booking.status !== 'cancelled' && (params as any).callId) {
    await recordOutcome({
      ctx,
      callId: (params as any).callId,
      outcome: 'booked',
      metadata: { provider: cal.slug, bookingId: booking.id },
    }).catch(() => undefined)
  }
  return {
    success: booking.status !== 'cancelled',
    bookingId: booking.id,
    start: booking.start,
    end: booking.end,
    provider: cal.slug,
  }
}

export async function sendSMS(
  ctx: PackContext,
  params: { to: string; body: string; mediaUrl?: string[] },
) {
  ensureAllowed(ctx, 'sendSMS')
  const sms = resolveSMS(ctx.integrationMap, await credsFor(ctx, smsSlug(ctx.integrationMap)))
  const res = await sms.send(params)
  return { success: !!res.id, messageId: res.id, status: res.status, provider: sms.slug }
}

export async function lookupContact(
  ctx: PackContext,
  params: { phone: string; create_if_new?: boolean; name?: string; email?: string },
) {
  ensureAllowed(ctx, 'lookupContact')

  // For clinical packs (dental, vet) the PMS is the source of truth.
  // When integration_map names a pms, prefer it and surface PMS-specific
  // context like recallType + recallIntervalMonths so the agent can
  // distinguish perio from prophy without inventing.
  const pms = pmsSlug(ctx.integrationMap)
  if (pms) {
    try {
      const pmsClient = resolvePMS(ctx.integrationMap, await credsFor(ctx, pms))
      const patient = await pmsClient.lookupPatientByPhone(params.phone)
      if (patient) {
        return {
          found: true,
          source: 'pms',
          provider: pmsClient.slug,
          contact: {
            id: patient.id,
            firstName: patient.firstName,
            lastName: patient.lastName,
            phone: patient.phone,
            email: patient.email,
          },
          recall: patient.recallType
            ? {
                type: patient.recallType,
                intervalMonths: patient.recallIntervalMonths,
                lastVisitAt: patient.lastVisitAt,
              }
            : null,
        }
      }
    } catch (e) {
      console.error('[packs] PMS lookup failed, falling back to CRM:', e)
    }
  }

  const crm = resolveCRM(ctx.integrationMap, await credsFor(ctx, crmSlug(ctx.integrationMap)))
  const existing = await crm.lookupByPhone(params.phone)
  if (existing) {
    return { found: true, contact: existing, provider: crm.slug }
  }
  if (params.create_if_new) {
    const [firstName, ...rest] = (params.name ?? '').split(' ')
    const created = await crm.upsertContact({
      phone: params.phone,
      firstName: firstName || undefined,
      lastName: rest.join(' ') || undefined,
      email: params.email,
    })
    return { found: false, created: true, contact: created, provider: crm.slug }
  }
  return { found: false, contact: null, provider: crm.slug }
}

// ─── Vertical-specific tools (loaded only when in pack tool_subset) ──

import { supabaseAdmin } from '../supabase'
import { recordOutcome } from './outcomes'

export async function escalateEmergency(
  ctx: PackContext,
  params: { symptom: string; callId?: string; callerPhone?: string; petName?: string },
) {
  ensureAllowed(ctx, 'escalateEmergency')
  const emergencyNumber = ctx.kbValues.emergency_routing_number as string | undefined
  const hospitalAddress = ctx.kbValues.emergency_hospital_address as string | undefined

  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'escalateEmergency',
    parameters: params,
    result: { escalated: true, routed_to: emergencyNumber },
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, severity: 'critical' },
    timestamp: new Date().toISOString(),
  })

  // Optional fan-out to alerting (Slack/PagerDuty) when configured.
  try {
    const { sendAlert } = await import('../alerting')
    await sendAlert({
      title: `Emergency triage — ${ctx.packSlug}`,
      message: `Symptom: ${params.symptom}${params.petName ? ` · Pet: ${params.petName}` : ''}`,
      severity: 'critical',
      source: ctx.tenantId,
      context: { callId: params.callId, callerPhone: params.callerPhone },
      dedupeKey: params.callId,
    })
  } catch {
    /* alerting is optional */
  }

  if (params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'emergency_escalated',
      metadata: { symptom: params.symptom },
    }).catch(() => undefined)
  }
  return {
    escalated: true,
    instruction: 'transfer_to_emergency',
    emergency_number: emergencyNumber ?? null,
    hospital_address: hospitalAddress ?? null,
    do_not_diagnose: true,
  }
}

export async function createRefillRequest(
  ctx: PackContext,
  params: {
    petName: string
    medication: string
    lastFillDate?: string
    ownerPhone: string
    notes?: string
    callId?: string
  },
) {
  ensureAllowed(ctx, 'createRefillRequest')
  const { error } = await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'createRefillRequest',
    parameters: params,
    result: { queued: true, policy_text: ctx.kbValues.refill_policy ?? null },
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'refill_request' },
    timestamp: new Date().toISOString(),
  })
  if (error) throw new Error(`Refill request log failed: ${error.message}`)
  if (params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'refill_requested',
      metadata: { medication: params.medication, petName: params.petName },
    }).catch(() => undefined)
  }
  return {
    queued: true,
    policy: ctx.kbValues.refill_policy ?? null,
    do_not_promise_turnaround: true,
  }
}

export async function flagAllergenAndTransfer(
  ctx: PackContext,
  params: { allergen: string; partySize?: number; callId?: string },
) {
  ensureAllowed(ctx, 'flagAllergenAndTransfer')
  const transferPhone = ctx.kbValues.allergen_transfer_phone as string | undefined
  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'flagAllergenAndTransfer',
    parameters: params,
    result: { transferred_to: transferPhone, allergen: params.allergen },
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'allergen_flag' },
    timestamp: new Date().toISOString(),
  })
  if (params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'allergen_flagged',
      metadata: { allergen: params.allergen },
    }).catch(() => undefined)
  }
  return {
    flagged: true,
    instruction: 'transfer_to_staff',
    transfer_phone: transferPhone ?? null,
    do_not_confirm_safety: true,
  }
}

export async function conflictCheck(
  ctx: PackContext,
  params: {
    callerFullName: string
    callerDobOrAddress?: string
    opposingPartyName?: string
    otherParties?: string[]
    matterState?: string
    callId?: string
  },
) {
  ensureAllowed(ctx, 'conflictCheck')

  // Conflict check semantics:
  //   - Run a fuzzy match against PMS (when configured) for caller +
  //     each named adverse party.
  //   - If ANY match against an existing matter, return conflict=true
  //     WITHOUT the reason. The reason itself is privileged.
  //   - Persist a conflict_check_id we can later attach to the intake.
  let conflict = false
  let pmsProvider: string | null = null
  const pms = pmsSlug(ctx.integrationMap)
  if (pms) {
    try {
      const pmsClient = resolvePMS(ctx.integrationMap, await credsFor(ctx, pms))
      pmsProvider = pmsClient.slug
      const names = [params.callerFullName, params.opposingPartyName, ...(params.otherParties ?? [])]
        .filter(Boolean)
        .map(n => String(n))
      for (const fullName of names) {
        const [first, ...rest] = fullName.split(/\s+/)
        const last = rest.join(' ')
        if (!last) continue
        const hit = await pmsClient
          .lookupPatientByIdentity({
            firstName: first,
            lastName: last,
            dob: params.callerDobOrAddress ?? '',
          })
          .catch(() => null)
        if (hit) {
          conflict = true
          break
        }
      }
    } catch (e) {
      console.error('[packs] conflict check PMS error:', e)
    }
  }

  const { data, error } = await supabaseAdmin
    .from('voice_agent_function_calls')
    .insert({
      call_id: params.callId ?? null,
      function_name: 'conflictCheck',
      // Names are intentionally hashed in the public log; the reason is never returned.
      parameters: {
        callerFullName: hashName(params.callerFullName),
        opposingPartyName: params.opposingPartyName ? hashName(params.opposingPartyName) : null,
        otherParties: (params.otherParties ?? []).map(hashName),
        matterState: params.matterState ?? null,
      },
      result: { conflict, pms_provider: pmsProvider },
      metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'conflict_check' },
      timestamp: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(`conflictCheck log failed: ${error.message}`)

  return {
    conflict,
    conflict_check_id: (data as any)?.id ?? null,
    pms_provider: pmsProvider,
    do_not_reveal_reason: true,
  }
}

export async function createIntakeRecord(
  ctx: PackContext,
  params: {
    callerFullName: string
    callerPhone: string
    callerEmail?: string
    matterState: string
    practiceArea: string
    incidentSummary: string
    incidentDate?: string
    urgentReview?: boolean
    conflictCheckId?: string
    callId?: string
  },
) {
  ensureAllowed(ctx, 'createIntakeRecord')

  if (!params.conflictCheckId) {
    return {
      created: false,
      reason: 'conflict_check_required',
      message: 'Run conflictCheck first; intake cannot be persisted without it.',
    }
  }

  const { data, error } = await supabaseAdmin
    .from('voice_agent_function_calls')
    .insert({
      call_id: params.callId ?? null,
      function_name: 'createIntakeRecord',
      parameters: {
        ...params,
        callerFullName: hashName(params.callerFullName),
        callerPhone: '[REDACTED]',
        callerEmail: params.callerEmail ? '[REDACTED]' : null,
      },
      result: { intake_id: cryptoRandomId(), urgent_review: !!params.urgentReview },
      metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'legal_intake' },
      timestamp: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(`intake create failed: ${error.message}`)

  if (params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'qualified_lead',
      metadata: { practice_area: params.practiceArea, urgent_review: !!params.urgentReview },
    }).catch(() => undefined)
  }

  return {
    created: true,
    intake_id: (data as any)?.id ?? null,
    urgent_review: !!params.urgentReview,
  }
}

// ─── Dealership tools ─────────────────────────────────────────────────

interface InventoryVehicle {
  vin?: string
  stock?: string
  year?: number
  make?: string
  model?: string
  trim?: string
  mileage?: number
  priceCents?: number
  bodyStyle?: string
  exteriorColor?: string
  status?: string
}

async function fetchInventoryFeed(url: string): Promise<InventoryVehicle[]> {
  // Best-effort fetch + decode. Many feeds are JSON arrays at the root;
  // some wrap under data/vehicles. We accept both. CSV / XML feeds need a
  // tenant-specific bridge — out of scope for the runtime tool.
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } })
    if (!res.ok) return []
    const data: any = await res.json()
    const arr: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.vehicles)
          ? data.vehicles
          : []
    return arr.map((v: any) => ({
      vin: v.vin ?? v.VIN,
      stock: v.stock_number ?? v.stockNumber ?? v.stock,
      year: v.year ?? v.modelYear,
      make: v.make ?? v.brand,
      model: v.model,
      trim: v.trim,
      mileage: v.mileage ?? v.odometer,
      priceCents:
        typeof v.price_cents === 'number'
          ? v.price_cents
          : typeof v.price === 'number'
            ? Math.round(v.price * 100)
            : undefined,
      bodyStyle: v.body_style ?? v.bodyStyle,
      exteriorColor: v.exterior_color ?? v.color,
      status: v.status ?? 'available',
    }))
  } catch {
    return []
  }
}

export async function searchInventory(
  ctx: PackContext,
  params: {
    query?: string
    year?: number
    make?: string
    model?: string
    maxPriceCents?: number
    limit?: number
    callId?: string
  },
) {
  ensureAllowed(ctx, 'searchInventory')

  const feedUrl = ctx.kbValues.inventory_feed_url as string | undefined
  if (!feedUrl) {
    return {
      vehicles: [],
      count: 0,
      reason: 'inventory_feed_unconfigured',
      do_not_invent_inventory: true,
    }
  }

  const all = await fetchInventoryFeed(feedUrl)
  const q = params.query?.toLowerCase().trim()
  const matched = all.filter(v => {
    if (params.year && v.year !== params.year) return false
    if (params.make && v.make?.toLowerCase() !== params.make.toLowerCase()) return false
    if (params.model && !v.model?.toLowerCase().includes(params.model.toLowerCase())) return false
    if (params.maxPriceCents && v.priceCents && v.priceCents > params.maxPriceCents) return false
    if (q) {
      const hay = `${v.year ?? ''} ${v.make ?? ''} ${v.model ?? ''} ${v.trim ?? ''} ${v.bodyStyle ?? ''} ${v.exteriorColor ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return v.status !== 'sold'
  })
  const limit = Math.max(1, Math.min(10, params.limit ?? 5))
  const top = matched.slice(0, limit)

  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'searchInventory',
    parameters: params,
    result: { matched_count: matched.length, returned: top.length },
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'inventory_search' },
    timestamp: new Date().toISOString(),
  })

  return {
    vehicles: top,
    count: matched.length,
    feed_url: feedUrl,
    quote_estimated: true,
    do_not_invent_inventory: true,
  }
}

export async function bookTestDrive(
  ctx: PackContext,
  params: {
    name: string
    phone: string
    email: string
    vin: string
    date: string
    time: string
    salespersonId?: string
    notes?: string
    callId?: string
  },
) {
  ensureAllowed(ctx, 'bookTestDrive')
  const cal = resolveCalendar(ctx.integrationMap, await credsFor(ctx, calendarSlug(ctx.integrationMap)))
  const startIso = `${params.date}T${params.time.length === 5 ? params.time + ':00' : params.time}`
  const booking = await cal.bookSlot({
    eventTypeId: ctx.kbValues.default_event_type_id as string | undefined,
    start: new Date(startIso).toISOString(),
    attendeeName: params.name,
    attendeeEmail: params.email,
    attendeePhone: params.phone,
    notes: `Test drive — VIN ${params.vin}${params.notes ? ` — ${params.notes}` : ''}`,
    metadata: {
      tenant_id: ctx.tenantId,
      pack_slug: ctx.packSlug,
      install_id: ctx.installId,
      kind: 'test_drive',
      vin: params.vin,
      salespersonId: params.salespersonId,
    },
  })

  if (params.callId && booking.status !== 'cancelled') {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'test_drive_booked',
      metadata: { vin: params.vin, salespersonId: params.salespersonId },
    }).catch(() => undefined)
  }

  return {
    success: booking.status !== 'cancelled',
    bookingId: booking.id,
    start: booking.start,
    vin: params.vin,
    provider: cal.slug,
  }
}

export async function bookServiceAppointment(
  ctx: PackContext,
  params: {
    name: string
    phone: string
    email?: string
    vin?: string
    serviceType: string
    date: string
    time: string
    advisorId?: string
    notes?: string
    callId?: string
  },
) {
  ensureAllowed(ctx, 'bookServiceAppointment')
  const cal = resolveCalendar(ctx.integrationMap, await credsFor(ctx, calendarSlug(ctx.integrationMap)))
  const startIso = `${params.date}T${params.time.length === 5 ? params.time + ':00' : params.time}`
  const booking = await cal.bookSlot({
    eventTypeId: ctx.kbValues.default_event_type_id as string | undefined,
    start: new Date(startIso).toISOString(),
    attendeeName: params.name,
    attendeeEmail: params.email ?? `${params.phone}@dealership.local`,
    attendeePhone: params.phone,
    notes: `Service — ${params.serviceType}${params.vin ? ` — VIN ${params.vin}` : ''}${params.notes ? ` — ${params.notes}` : ''}`,
    metadata: {
      tenant_id: ctx.tenantId,
      pack_slug: ctx.packSlug,
      install_id: ctx.installId,
      kind: 'service',
      vin: params.vin,
      advisorId: params.advisorId,
      serviceType: params.serviceType,
    },
  })

  if (params.callId && booking.status !== 'cancelled') {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'service_booked',
      metadata: { serviceType: params.serviceType, vin: params.vin },
    }).catch(() => undefined)
  }

  return {
    success: booking.status !== 'cancelled',
    bookingId: booking.id,
    start: booking.start,
    serviceType: params.serviceType,
    provider: cal.slug,
  }
}

export async function createSalesLead(
  ctx: PackContext,
  params: {
    name: string
    phone: string
    email?: string
    department: 'sales' | 'service' | 'parts' | 'finance' | 'trade' | 'fleet'
    vehicleOfInterest?: string
    leadSource?: string
    notes?: string
    callId?: string
  },
) {
  ensureAllowed(ctx, 'createSalesLead')
  const crm = resolveCRM(ctx.integrationMap, await credsFor(ctx, crmSlug(ctx.integrationMap)))
  const [firstName, ...rest] = (params.name ?? '').split(' ')
  const contact = await crm.upsertContact({
    phone: params.phone,
    firstName: firstName || undefined,
    lastName: rest.join(' ') || undefined,
    email: params.email,
    metadata: {
      department: params.department,
      vehicleOfInterest: params.vehicleOfInterest,
      leadSource: params.leadSource ?? 'AI Voice Assistant',
      notes: params.notes,
    },
  })

  if (params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'qualified_lead',
      metadata: {
        department: params.department,
        vehicleOfInterest: params.vehicleOfInterest,
        provider: crm.slug,
      },
    }).catch(() => undefined)
  }

  return { success: true, contactId: contact.id, provider: crm.slug }
}

export async function escalateToFinance(
  ctx: PackContext,
  params: {
    reason: string
    callerPhone: string
    callerName: string
    vehicleOfInterest?: string
    callId?: string
  },
) {
  ensureAllowed(ctx, 'escalateToFinance')

  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'escalateToFinance',
    parameters: {
      reason: params.reason,
      callerPhone: '[REDACTED]',
      callerName: hashName(params.callerName),
      vehicleOfInterest: params.vehicleOfInterest ?? null,
    },
    result: { escalated: true },
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'finance_handoff' },
    timestamp: new Date().toISOString(),
  })

  if (params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'finance_handoff',
      metadata: { reason: params.reason },
    }).catch(() => undefined)
  }

  return {
    escalated: true,
    instruction: 'transfer_or_callback_finance_manager',
    do_not_quote_payment_or_apr: true,
  }
}

export async function escalateToAppraiser(
  ctx: PackContext,
  params: {
    vehicleYear: number
    make: string
    model: string
    mileage: number
    condition?: string
    vin?: string
    callerPhone: string
    callerName: string
    callId?: string
  },
) {
  ensureAllowed(ctx, 'escalateToAppraiser')

  const tool = ctx.kbValues.trade_appraisal_tool as string | undefined

  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'escalateToAppraiser',
    parameters: {
      vehicleYear: params.vehicleYear,
      make: params.make,
      model: params.model,
      mileage: params.mileage,
      condition: params.condition ?? null,
      vin: params.vin ?? null,
      callerPhone: '[REDACTED]',
      callerName: hashName(params.callerName),
    },
    result: { escalated: true, tool: tool ?? null },
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'appraisal_handoff' },
    timestamp: new Date().toISOString(),
  })

  if (params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'appraisal_handoff',
      metadata: { make: params.make, model: params.model, year: params.vehicleYear },
    }).catch(() => undefined)
  }

  return {
    escalated: true,
    instruction: 'book_in_person_appraisal',
    appraisal_tool: tool ?? null,
    range_only_no_hard_number: true,
  }
}

export async function logRecallInquiry(
  ctx: PackContext,
  params: {
    vin: string
    callerPhone: string
    callerName?: string
    recallCampaign?: string
    callId?: string
  },
) {
  ensureAllowed(ctx, 'logRecallInquiry')

  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'logRecallInquiry',
    parameters: {
      vin: params.vin,
      callerPhone: '[REDACTED]',
      callerName: params.callerName ? hashName(params.callerName) : null,
      recallCampaign: params.recallCampaign ?? null,
    },
    result: { logged: true },
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'recall_inquiry' },
    timestamp: new Date().toISOString(),
  })

  if (params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'recall_logged',
      metadata: { vin: params.vin, campaign: params.recallCampaign ?? null },
    }).catch(() => undefined)
  }

  return { logged: true, instruction: 'route_to_service_advisor_with_vin' }
}

// ─── Insurance compliance gate tools ──────────────────────────────────

export async function queryRND(
  ctx: PackContext,
  params: { phone: string; callId?: string },
) {
  ensureAllowed(ctx, 'queryRND')

  // Honor the cache window from compliance flags. We treat any prior
  // queryRND log within rnd_cache_seconds as a hit and reuse its result.
  const cacheSeconds =
    Number((ctx.kbValues as any)?.rnd_cache_seconds ?? 86400) || 86400

  const cutoffIso = new Date(Date.now() - cacheSeconds * 1000).toISOString()
  const { data: prior } = await supabaseAdmin
    .from('voice_agent_function_calls')
    .select('id, result, timestamp')
    .eq('function_name', 'queryRND')
    .filter('parameters->>phoneHash', 'eq', hashName(params.phone))
    .gte('timestamp', cutoffIso)
    .order('timestamp', { ascending: false })
    .limit(1)

  if (prior?.[0]) {
    return {
      ...((prior[0] as any).result ?? {}),
      cached: true,
      queried_at: (prior[0] as any).timestamp,
    }
  }

  // Stub provider call — real implementation hits reassigned.us /
  // PossibleNOW / Gryphon. Defaults to "not_reassigned" when unconfigured
  // so a caller can explicitly opt-in via integration_map.
  const provider = (ctx.kbValues.rnd_provider as string | undefined) ?? 'none'
  const result = { reassigned: false, provider, queried_at: new Date().toISOString() }

  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'queryRND',
    parameters: { phoneHash: hashName(params.phone) },
    result,
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'rnd_query' },
    timestamp: new Date().toISOString(),
  })

  if (result.reassigned && params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'rnd_blocked',
      metadata: { provider },
    }).catch(() => undefined)
  }

  return { ...result, cached: false, do_not_proceed_if_reassigned: true }
}

export async function scrubDNC(
  ctx: PackContext,
  params: { phone: string; state?: string; callId?: string },
) {
  ensureAllowed(ctx, 'scrubDNC')

  // Internal DNC list: any call to internalDNCAdded matching this phone.
  const { data: internal } = await supabaseAdmin
    .from('voice_agent_function_calls')
    .select('id')
    .eq('function_name', 'internalDNCAdded')
    .filter('parameters->>phoneHash', 'eq', hashName(params.phone))
    .limit(1)

  const onInternalDNC = !!internal?.[0]

  // Federal + state DNC scrubs are stubbed — wire to DNC.com / Gryphon /
  // ContactCenterCompliance via per-tenant credentials. Default-deny when
  // internal hits; otherwise allow.
  const blocked = onInternalDNC

  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'scrubDNC',
    parameters: { phoneHash: hashName(params.phone), state: params.state ?? null },
    result: { blocked, lists_checked: ['internal'], state: params.state ?? null },
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'dnc_scrub' },
    timestamp: new Date().toISOString(),
  })

  if (blocked && params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'dnc_blocked',
      metadata: { state: params.state ?? null, internal: onInternalDNC },
    }).catch(() => undefined)
  }

  return {
    blocked,
    lists_checked: ['internal'],
    do_not_proceed_if_blocked: true,
  }
}

export async function checkCarrierAppointment(
  ctx: PackContext,
  params: {
    carrier: string
    state: string
    lob: string
    callId?: string
  },
) {
  ensureAllowed(ctx, 'checkCarrierAppointment')

  const appts = (ctx.kbValues.carrier_appointments as Array<any> | undefined) ?? []
  const stateUp = params.state.toUpperCase()
  const lobLow = params.lob.toLowerCase()
  const carrierLow = params.carrier.toLowerCase()

  const matched = appts.find((a: any) => {
    if (String(a.carrier ?? '').toLowerCase() !== carrierLow) return false
    if (Array.isArray(a.states) && !a.states.map((s: string) => s.toUpperCase()).includes(stateUp))
      return false
    if (Array.isArray(a.lobs) && !a.lobs.map((l: string) => l.toLowerCase()).includes(lobLow))
      return false
    return a.status !== 'terminated'
  })

  const result = {
    appointed: !!matched && matched.status !== 'limited',
    limited: matched?.status === 'limited',
    status: matched?.status ?? 'none',
  }

  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'checkCarrierAppointment',
    parameters: { carrier: params.carrier, state: stateUp, lob: lobLow },
    result,
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'carrier_gate' },
    timestamp: new Date().toISOString(),
  })

  if (!result.appointed && params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'carrier_not_appointed',
      metadata: { carrier: params.carrier, state: stateUp, lob: lobLow },
    }).catch(() => undefined)
  }

  return {
    ...result,
    do_not_quote_if_not_appointed: true,
    decline_message: result.appointed
      ? null
      : `We're not appointed with ${params.carrier} in ${stateUp} for ${params.lob} — would you like a quote from a carrier we do represent?`,
  }
}

export async function checkProducerLicense(
  ctx: PackContext,
  params: { state: string; lob: string; callId?: string },
) {
  ensureAllowed(ctx, 'checkProducerLicense')

  const producers = (ctx.kbValues.producers as Array<any> | undefined) ?? []
  const stateUp = params.state.toUpperCase()
  const lobLow = params.lob.toLowerCase()

  const matched = producers.find((p: any) => {
    const states = Array.isArray(p.states) ? p.states.map((s: string) => s.toUpperCase()) : []
    const lobs = Array.isArray(p.lobs) ? p.lobs.map((l: string) => l.toLowerCase()) : []
    return states.includes(stateUp) && lobs.includes(lobLow)
  })

  const result = {
    licensed: !!matched,
    producer_name: matched?.name ?? null,
    npn: matched?.npn ?? null,
  }

  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'checkProducerLicense',
    parameters: { state: stateUp, lob: lobLow },
    result,
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'producer_gate' },
    timestamp: new Date().toISOString(),
  })

  if (!result.licensed && params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'producer_not_licensed',
      metadata: { state: stateUp, lob: lobLow },
    }).catch(() => undefined)
  }

  return {
    ...result,
    do_not_quote_if_not_licensed: true,
    decline_message: result.licensed
      ? null
      : `We don't have a licensed producer for ${params.lob} in ${stateUp} right now — let me take a message and have someone reach out.`,
  }
}

export async function captureSOA(
  ctx: PackContext,
  params: {
    fullName: string
    address: string
    phone: string
    productsToDiscuss: string[]
    agentName: string
    agentNpn: string
    attestationVerbal: boolean
    callerInitiated?: boolean
    enrollmentPeriod?: 'AEP' | 'OEP' | 'ICEP' | 'IEP' | 'SEP' | 'none'
    callId?: string
  },
) {
  ensureAllowed(ctx, 'captureSOA')

  // 48-hour wait window logic. Pre Oct 1, 2026, SOA must be captured at
  // least 48 hours before the appointment unless one of the carve-outs
  // applies (last-4-days of AEP/OEP/ICEP/SEP, beneficiary-initiated walk-in).
  const sunsetIso =
    ((ctx.kbValues as any)?.medicare_soa_48h_wait_until as string | undefined) ?? '2026-09-30'
  const fortyEightHourRuleActive = new Date().toISOString().slice(0, 10) <= String(sunsetIso)

  const carveOut =
    params.callerInitiated === true ||
    (params.enrollmentPeriod && ['AEP', 'OEP', 'ICEP', 'SEP'].includes(params.enrollmentPeriod))

  const wait_required = fortyEightHourRuleActive && !carveOut

  const { data, error } = await supabaseAdmin
    .from('voice_agent_function_calls')
    .insert({
      call_id: params.callId ?? null,
      function_name: 'captureSOA',
      parameters: {
        fullName: hashName(params.fullName),
        address: '[REDACTED]',
        phone: '[REDACTED]',
        productsToDiscuss: params.productsToDiscuss,
        agentName: params.agentName,
        agentNpn: params.agentNpn,
        attestationVerbal: params.attestationVerbal,
        enrollmentPeriod: params.enrollmentPeriod ?? null,
      },
      result: {
        captured: params.attestationVerbal === true,
        wait_required,
        retention_class: 'v2',
      },
      metadata: {
        pack_slug: ctx.packSlug,
        install_id: ctx.installId,
        kind: 'medicare_soa',
        retention_years: 10,
      },
      timestamp: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(`captureSOA failed: ${error.message}`)

  if (params.callId && params.attestationVerbal) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'soa_captured',
      metadata: { products: params.productsToDiscuss, agent_npn: params.agentNpn },
    }).catch(() => undefined)
  }

  return {
    captured: params.attestationVerbal === true,
    soa_id: (data as any)?.id ?? null,
    wait_required,
    earliest_appointment_iso: wait_required
      ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      : new Date().toISOString(),
    retention_years: 10,
    do_not_discuss_benefits_until_captured: true,
  }
}

export async function logTPMODisclaimer(
  ctx: PackContext,
  params: {
    spokenAt?: string
    transcriptOffsetMs?: number
    placement?: 'before_benefits' | 'first_minute'
    carrierCount?: number
    productCount?: number
    callId?: string
  },
) {
  ensureAllowed(ctx, 'logTPMODisclaimer')

  const placement =
    params.placement ??
    ((ctx.kbValues as any)?.medicare_tpmo_disclaimer_placement as string | undefined) ??
    'before_benefits'

  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'logTPMODisclaimer',
    parameters: {
      spokenAt: params.spokenAt ?? new Date().toISOString(),
      transcriptOffsetMs: params.transcriptOffsetMs ?? null,
      placement,
      carrierCount: params.carrierCount ?? ctx.kbValues.tpmo_carrier_count ?? null,
      productCount: params.productCount ?? ctx.kbValues.tpmo_product_count ?? null,
    },
    result: { logged: true, placement },
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'tpmo_disclaimer' },
    timestamp: new Date().toISOString(),
  })

  if (params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'tpmo_disclosed',
      metadata: { placement },
    }).catch(() => undefined)
  }

  return { logged: true, placement, may_discuss_benefits: true }
}

// ─── Mortgage tools ───────────────────────────────────────────────────

export async function verifyConsent(
  ctx: PackContext,
  params: { callerPhone: string; channel: 'inbound' | 'outbound'; callId?: string },
) {
  ensureAllowed(ctx, 'verifyConsent')

  // Inbound calls don't need TCPA consent — caller initiated. Only
  // outbound (we dialed them) requires the artifact naming our company.
  if (params.channel === 'inbound') {
    return { verified: true, reason: 'inbound_call', do_not_block: true }
  }

  const { data, error } = await supabaseAdmin
    .from('voice_agent_function_calls')
    .select('id, parameters, result')
    .eq('function_name', 'consentArtifactStored')
    .filter('parameters->>callerPhone', 'eq', params.callerPhone)
    .order('timestamp', { ascending: false })
    .limit(1)

  if (error) throw new Error(`verifyConsent lookup failed: ${error.message}`)

  const artifact = data?.[0]
  const namesUsCompany =
    artifact &&
    String((artifact as any).parameters?.lender_named ?? '').toLowerCase() ===
      String(ctx.kbValues.company_name ?? '').toLowerCase()

  const verified = !!artifact && !!namesUsCompany

  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'verifyConsent',
    parameters: { callerPhone: '[REDACTED]', channel: params.channel },
    result: { verified, has_artifact: !!artifact, names_us: namesUsCompany },
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'tcpa_consent' },
    timestamp: new Date().toISOString(),
  })

  return {
    verified,
    artifact_id: artifact ? (artifact as any).id : null,
    do_not_proceed_without_consent: !verified,
  }
}

export async function stage5of6Application(
  ctx: PackContext,
  params: {
    fullName: string
    annualIncomeCents: number
    propertyAddress: string
    estimatedValueCents: number
    loanAmountCents: number
    matterState: string
    productType: string
    callId?: string
    /** Set to true ONLY if caller insisted on volunteering SSN. */
    sensitive_volunteered?: boolean
  },
) {
  ensureAllowed(ctx, 'stage5of6Application')

  const trid_clock_risk = params.sensitive_volunteered === true

  const { data, error } = await supabaseAdmin
    .from('voice_agent_function_calls')
    .insert({
      call_id: params.callId ?? null,
      function_name: 'stage5of6Application',
      // Five-of-six fields are intake info, not PHI; we still hash the
      // name + redact the address to keep PII out of operational logs.
      parameters: {
        fullName: hashName(params.fullName),
        annualIncomeCents: params.annualIncomeCents,
        propertyAddress: '[REDACTED]',
        estimatedValueCents: params.estimatedValueCents,
        loanAmountCents: params.loanAmountCents,
        matterState: params.matterState,
        productType: params.productType,
      },
      result: { staged: true, trid_clock_risk },
      metadata: {
        pack_slug: ctx.packSlug,
        install_id: ctx.installId,
        kind: 'mortgage_5_of_6',
        trid_clock_risk,
      },
      timestamp: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(`stage5of6 failed: ${error.message}`)

  if (trid_clock_risk) {
    try {
      const { sendAlert } = await import('../alerting')
      await sendAlert({
        title: `TRID clock risk — ${ctx.packSlug}`,
        message:
          'Caller volunteered SSN during intake; the 3-day Loan Estimate clock may have started.',
        severity: 'warning',
        source: ctx.tenantId,
        context: { callId: params.callId, install_id: ctx.installId },
      })
    } catch {
      /* alerting optional */
    }
  }

  return {
    staged: true,
    application_id: (data as any)?.id,
    trid_clock_risk,
    do_not_solicit_ssn: true,
  }
}

export async function escalateToMLO(
  ctx: PackContext,
  params: {
    matterState: string
    productType: string
    applicationId?: string
    callerPhone: string
    callerName: string
    callId?: string
  },
) {
  ensureAllowed(ctx, 'escalateToMLO')

  // Pick a state-licensed LO from kb_values.loan_officers.
  const officers = (ctx.kbValues.loan_officers as Array<any> | undefined) ?? []
  const matched = officers.find(
    (lo: any) =>
      Array.isArray(lo.states_licensed) &&
      lo.states_licensed.includes(params.matterState.toUpperCase()),
  )

  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'escalateToMLO',
    parameters: {
      matterState: params.matterState,
      productType: params.productType,
      callerPhone: '[REDACTED]',
      callerName: hashName(params.callerName),
      applicationId: params.applicationId ?? null,
    },
    result: {
      mlo_matched: !!matched,
      mlo_name: matched?.name ?? null,
      mlo_nmls_id: matched?.nmls_id ?? null,
    },
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'mlo_handoff' },
    timestamp: new Date().toISOString(),
  })

  if (params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'qualified_lead',
      metadata: { product_type: params.productType, matched_mlo: matched?.name ?? null },
    }).catch(() => undefined)
  }

  return {
    matched: !!matched,
    mlo_name: matched?.name ?? null,
    mlo_nmls_id: matched?.nmls_id ?? null,
    instruction: matched ? 'transfer_or_callback' : 'queue_for_compliance_review',
  }
}

function hashName(name: string): string {
  // Cheap, non-secret blur — keeps logs scanable without storing PII verbatim.
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i)
  return `name_${(h >>> 0).toString(36)}`
}

function cryptoRandomId(): string {
  // Use Node crypto when available, fall back to Math.random.
  try {
    return require('crypto').randomBytes(8).toString('hex')
  } catch {
    return Math.random().toString(36).slice(2, 18)
  }
}

export async function verifyInsurance(
  ctx: PackContext,
  params: {
    carrier: string
    memberId: string
    dob: string
    relationship?: 'self' | 'spouse' | 'child'
    callId?: string
  },
) {
  ensureAllowed(ctx, 'verifyInsurance')

  const inNetwork = ((ctx.kbValues.insurance_carriers_in_network as string[]) ?? []).includes(
    params.carrier.toLowerCase(),
  )
  const stediEnabled = ctx.kbValues.insurance_verify_via_stedi === true && !!process.env.STEDI_API_KEY

  let result: any
  if (!stediEnabled) {
    result = {
      verified: false,
      reason: stediEnabled ? 'stedi_unconfigured' : 'verification_not_enabled',
      in_network: inNetwork,
      carrier: params.carrier,
    }
  } else {
    try {
      const res = await fetch('https://healthcare.us.stedi.com/2024-04-01/eligibility', {
        method: 'POST',
        headers: {
          authorization: `Key ${process.env.STEDI_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          tradingPartnerServiceId: params.carrier,
          subscriber: { memberId: params.memberId, dateOfBirth: params.dob },
          encounter: { serviceTypeCodes: ['35'] }, // 35 = dental care
        }),
      })
      const data: any = await res.ok ? await res.json() : null
      result = {
        verified: !!data,
        in_network: inNetwork,
        carrier: params.carrier,
        coverage: data?.benefitsInformation ?? null,
        raw_summary: data?.subscriber ? `Subscriber active: ${data.subscriber.firstName ?? ''}` : null,
      }
    } catch (e: any) {
      result = { verified: false, reason: 'stedi_error', error: e?.message ?? 'unknown' }
    }
  }

  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'verifyInsurance',
    parameters: { carrier: params.carrier, memberId: '[REDACTED]', dob: '[REDACTED]' },
    result,
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, kind: 'insurance_verify' },
    timestamp: new Date().toISOString(),
  })

  if (params.callId && result.verified) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'insurance_verified',
      metadata: { carrier: params.carrier, in_network: result.in_network },
    }).catch(() => undefined)
  }
  return { ...result, do_not_estimate: true, quote_verbatim_only: true }
}

export async function lifeSafetyInterrupt(
  ctx: PackContext,
  params: { hazard: string; callId?: string; callerPhone?: string },
) {
  ensureAllowed(ctx, 'lifeSafetyInterrupt')
  const safety911 = ctx.kbValues.life_safety_911_number as string | undefined
  const utility = ctx.kbValues.utility_emergency_number as string | undefined

  await supabaseAdmin.from('voice_agent_function_calls').insert({
    call_id: params.callId ?? null,
    function_name: 'lifeSafetyInterrupt',
    parameters: params,
    result: { interrupted: true, hazard: params.hazard, routed: { safety911, utility } },
    metadata: { pack_slug: ctx.packSlug, install_id: ctx.installId, severity: 'critical' },
    timestamp: new Date().toISOString(),
  })

  try {
    const { sendAlert } = await import('../alerting')
    await sendAlert({
      title: `Life-safety interrupt — ${ctx.packSlug}`,
      message: `Hazard: ${params.hazard}`,
      severity: 'critical',
      source: ctx.tenantId,
      context: { callId: params.callId, callerPhone: params.callerPhone },
      dedupeKey: params.callId,
    })
  } catch {
    /* alerting is optional */
  }

  if (params.callId) {
    await recordOutcome({
      ctx,
      callId: params.callId,
      outcome: 'life_safety_interrupted',
      metadata: { hazard: params.hazard },
    }).catch(() => undefined)
  }
  return {
    interrupted: true,
    instruction: 'route_to_emergency_then_offer_followup',
    safety_911: safety911 ?? null,
    utility_emergency: utility ?? null,
    do_not_schedule_first: true,
  }
}

/**
 * Single dispatch entrypoint for webhook handlers that have already
 * resolved a PackContext. Returns null if the tool isn't pack-aware
 * yet so the caller can fall back to legacy implementations.
 */
export async function runPackTool(
  ctx: PackContext,
  name: string,
  params: any,
): Promise<unknown | null> {
  switch (name) {
    case 'checkCalendar':
      return checkCalendar(ctx, params)
    case 'bookAppointment':
      return bookAppointment(ctx, params)
    case 'sendSMS':
      return sendSMS(ctx, params)
    case 'lookupContact':
      return lookupContact(ctx, params)
    case 'escalateEmergency':
      return escalateEmergency(ctx, params)
    case 'createRefillRequest':
      return createRefillRequest(ctx, params)
    case 'flagAllergenAndTransfer':
      return flagAllergenAndTransfer(ctx, params)
    case 'lifeSafetyInterrupt':
      return lifeSafetyInterrupt(ctx, params)
    case 'verifyInsurance':
      return verifyInsurance(ctx, params)
    case 'conflictCheck':
      return conflictCheck(ctx, params)
    case 'createIntakeRecord':
      return createIntakeRecord(ctx, params)
    case 'verifyConsent':
      return verifyConsent(ctx, params)
    case 'stage5of6Application':
      return stage5of6Application(ctx, params)
    case 'escalateToMLO':
      return escalateToMLO(ctx, params)
    case 'searchInventory':
      return searchInventory(ctx, params)
    case 'bookTestDrive':
      return bookTestDrive(ctx, params)
    case 'bookServiceAppointment':
      return bookServiceAppointment(ctx, params)
    case 'createSalesLead':
      return createSalesLead(ctx, params)
    case 'escalateToFinance':
      return escalateToFinance(ctx, params)
    case 'escalateToAppraiser':
      return escalateToAppraiser(ctx, params)
    case 'logRecallInquiry':
      return logRecallInquiry(ctx, params)
    case 'queryRND':
      return queryRND(ctx, params)
    case 'scrubDNC':
      return scrubDNC(ctx, params)
    case 'checkCarrierAppointment':
      return checkCarrierAppointment(ctx, params)
    case 'checkProducerLicense':
      return checkProducerLicense(ctx, params)
    case 'captureSOA':
      return captureSOA(ctx, params)
    case 'logTPMODisclaimer':
      return logTPMODisclaimer(ctx, params)
    default:
      return null
  }
}
