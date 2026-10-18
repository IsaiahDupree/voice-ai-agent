/**
 * CalendarProvider adapter for ServiceTitan (FSM/dispatch).
 *
 * ServiceTitan's API uses tenant-scoped credentials + an OAuth client
 * credentials grant. Booking a job ≈ scheduling on a technician's calendar
 * for a given business unit + job type, so we map:
 *   listSlots → /jpm/v2/tenant/{id}/appointments/availability
 *   bookSlot  → /jpm/v2/tenant/{id}/jobs (create job + appointment)
 *   cancelBooking → /jpm/v2/tenant/{id}/jobs/{id}/cancel
 *
 * Env (per-tenant; in production these come from the integration_map
 * credential vault rather than process.env):
 *   SERVICETITAN_TENANT_ID
 *   SERVICETITAN_APP_KEY
 *   SERVICETITAN_OAUTH_TOKEN  (opaque bearer; refresh handled out of band)
 *   SERVICETITAN_DEFAULT_JOB_TYPE_ID
 *   SERVICETITAN_DEFAULT_BUSINESS_UNIT_ID
 */

import type {
  CalendarProvider,
  CalendarSlot,
  CalendarBookingInput,
  CalendarBooking,
  ProviderHealth,
} from './types'

const BASE = 'https://api.servicetitan.io'

interface StEnv {
  tenantId: string
  appKey: string
  token: string
  defaultJobTypeId?: string
  defaultBusinessUnitId?: string
}

function readEnv(): StEnv {
  const tenantId = process.env.SERVICETITAN_TENANT_ID
  const appKey = process.env.SERVICETITAN_APP_KEY
  const token = process.env.SERVICETITAN_OAUTH_TOKEN
  if (!tenantId || !appKey || !token) {
    throw new Error('SERVICETITAN_TENANT_ID, SERVICETITAN_APP_KEY, SERVICETITAN_OAUTH_TOKEN required')
  }
  return {
    tenantId,
    appKey,
    token,
    defaultJobTypeId: process.env.SERVICETITAN_DEFAULT_JOB_TYPE_ID,
    defaultBusinessUnitId: process.env.SERVICETITAN_DEFAULT_BUSINESS_UNIT_ID,
  }
}

function authHeaders(env: StEnv): Record<string, string> {
  return {
    authorization: `Bearer ${env.token}`,
    'st-app-key': env.appKey,
    'content-type': 'application/json',
  }
}

export class ServiceTitanCalendar implements CalendarProvider {
  readonly slug = 'servicetitan'

  async listSlots(opts: { eventTypeId?: string | number; date: string }): Promise<CalendarSlot[]> {
    const env = readEnv()
    const jobTypeId = String(opts.eventTypeId ?? env.defaultJobTypeId ?? '')
    if (!jobTypeId) return []

    const start = `${opts.date}T00:00:00Z`
    const end = `${opts.date}T23:59:59Z`
    const url =
      `${BASE}/jpm/v2/tenant/${env.tenantId}/appointments/availability` +
      `?startsOnOrAfter=${encodeURIComponent(start)}` +
      `&startsOnOrBefore=${encodeURIComponent(end)}` +
      `&jobTypeIds=${encodeURIComponent(jobTypeId)}`

    const res = await fetch(url, { headers: authHeaders(env) })
    if (!res.ok) throw new Error(`ServiceTitan availability ${res.status}: ${await res.text()}`)
    const data: any = await res.json()
    return (data?.data ?? []).map((s: any) => ({
      start: s.start ?? s.startUtc,
      end: s.end ?? s.endUtc,
      available: s.available !== false,
    }))
  }

  async bookSlot(input: CalendarBookingInput): Promise<CalendarBooking> {
    const env = readEnv()
    const jobTypeId = Number(input.eventTypeId ?? env.defaultJobTypeId ?? 0)
    const businessUnitId = Number(env.defaultBusinessUnitId ?? 0)
    if (!jobTypeId || !businessUnitId) {
      throw new Error('ServiceTitan booking requires jobTypeId + businessUnitId')
    }

    const body = {
      customerId: 0, // resolved server-side via phone match in production
      locationId: 0,
      businessUnitId,
      jobTypeId,
      campaignId: 0,
      summary: input.notes ?? `Booked via voice AI for ${input.attendeeName}`,
      appointments: [{ start: input.start, end: input.end ?? input.start }],
      contactDetails: {
        firstName: input.attendeeName.split(' ')[0],
        lastName: input.attendeeName.split(' ').slice(1).join(' ') || '-',
        email: input.attendeeEmail,
        phone: input.attendeePhone,
      },
      metadata: input.metadata ?? {},
    }

    const res = await fetch(`${BASE}/jpm/v2/tenant/${env.tenantId}/jobs`, {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`ServiceTitan create job ${res.status}: ${await res.text()}`)
    const data: any = await res.json()
    return {
      id: String(data?.id ?? data?.jobId ?? ''),
      start: input.start,
      end: input.end ?? input.start,
      status: 'confirmed',
      raw: data,
    }
  }

  async cancelBooking(id: string, reason?: string): Promise<void> {
    const env = readEnv()
    const res = await fetch(
      `${BASE}/jpm/v2/tenant/${env.tenantId}/jobs/${encodeURIComponent(id)}/cancel`,
      {
        method: 'POST',
        headers: authHeaders(env),
        body: JSON.stringify({ reasonId: 0, memo: reason ?? 'cancelled by agent' }),
      },
    )
    if (!res.ok && res.status !== 404) {
      throw new Error(`ServiceTitan cancel ${res.status}: ${await res.text()}`)
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const ok =
      !!process.env.SERVICETITAN_TENANT_ID &&
      !!process.env.SERVICETITAN_APP_KEY &&
      !!process.env.SERVICETITAN_OAUTH_TOKEN
    return ok ? { healthy: true } : { healthy: false, message: 'ServiceTitan credentials missing' }
  }
}
