/**
 * CalendarProvider implementation for Booksy.
 *
 * Booksy's partner API is gated and tenant-specific (per-merchant
 * access tokens). We wrap the public Biz API surface that's available
 * via API key + business_id.
 *
 * Endpoints (Booksy Biz v2):
 *   GET  /api/v2/business/{business_id}/services/{service_id}/availabilities
 *   POST /api/v2/business/{business_id}/bookings
 *   POST /api/v2/business/{business_id}/bookings/{booking_id}/cancel
 *
 * Env (per-tenant, supplied via integration credentials in v2):
 *   BOOKSY_API_KEY      — Booksy API key
 *   BOOKSY_BUSINESS_ID  — Business id (a.k.a. shop id)
 *   BOOKSY_DEFAULT_SERVICE_ID — fallback when a pack tool doesn't pass one
 *
 * NOTE: This adapter targets Booksy's documented Biz API v2 shape. If
 * a tenant onboards under the older Booksy API, swap in a separate
 * adapter (registry slug 'booksy_v1') rather than branching this file.
 */

import type {
  CalendarProvider,
  CalendarSlot,
  CalendarBookingInput,
  CalendarBooking,
  ProviderHealth,
} from './types'

const BASE = 'https://us.booksy.com'

interface BooksyEnv {
  apiKey: string
  businessId: string
  defaultServiceId?: string
}

function readEnv(): BooksyEnv {
  const apiKey = process.env.BOOKSY_API_KEY
  const businessId = process.env.BOOKSY_BUSINESS_ID
  if (!apiKey || !businessId) {
    throw new Error('BOOKSY_API_KEY and BOOKSY_BUSINESS_ID required for Booksy provider')
  }
  return {
    apiKey,
    businessId,
    defaultServiceId: process.env.BOOKSY_DEFAULT_SERVICE_ID,
  }
}

function authHeaders(env: BooksyEnv): Record<string, string> {
  return {
    'x-api-key': env.apiKey,
    'content-type': 'application/json',
    'x-fingerprint': 'voice-ai-agent',
  }
}

function resolveServiceId(env: BooksyEnv, eventTypeId?: string | number): string {
  const id = eventTypeId != null ? String(eventTypeId) : ''
  if (id) return id
  if (env.defaultServiceId) return env.defaultServiceId
  throw new Error('Booksy service id required (eventTypeId or BOOKSY_DEFAULT_SERVICE_ID)')
}

export class BooksyCalendar implements CalendarProvider {
  readonly slug = 'booksy'

  async listSlots(opts: { eventTypeId?: string | number; date: string }): Promise<CalendarSlot[]> {
    const env = readEnv()
    const serviceId = resolveServiceId(env, opts.eventTypeId)
    const url =
      `${BASE}/api/v2/business/${env.businessId}/services/${serviceId}/availabilities` +
      `?date=${encodeURIComponent(opts.date)}`

    const res = await fetch(url, { headers: authHeaders(env) })
    if (!res.ok) throw new Error(`Booksy availabilities ${res.status}: ${await res.text()}`)
    const data: any = await res.json()
    const slots = data?.availabilities ?? data?.slots ?? []
    return (slots as any[]).map(s => ({
      start: s.start_at ?? s.time ?? s.start,
      end: s.end_at ?? s.end ?? s.start_at,
      available: s.available !== false,
    }))
  }

  async bookSlot(input: CalendarBookingInput): Promise<CalendarBooking> {
    const env = readEnv()
    const serviceId = resolveServiceId(env, input.eventTypeId)

    const body = {
      service_id: serviceId,
      start_at: new Date(input.start).toISOString(),
      customer: {
        name: input.attendeeName,
        email: input.attendeeEmail,
        phone: input.attendeePhone,
      },
      notes: input.notes,
      metadata: input.metadata ?? {},
    }

    const res = await fetch(`${BASE}/api/v2/business/${env.businessId}/bookings`, {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Booksy book ${res.status}: ${await res.text()}`)
    const data: any = await res.json()
    return {
      id: String(data?.booking?.id ?? data?.id ?? ''),
      start: data?.booking?.start_at ?? input.start,
      end: data?.booking?.end_at ?? input.end ?? input.start,
      status: 'confirmed',
      raw: data,
    }
  }

  async cancelBooking(id: string, reason?: string): Promise<void> {
    const env = readEnv()
    const res = await fetch(
      `${BASE}/api/v2/business/${env.businessId}/bookings/${encodeURIComponent(id)}/cancel`,
      {
        method: 'POST',
        headers: authHeaders(env),
        body: JSON.stringify({ reason: reason ?? 'cancelled by agent' }),
      },
    )
    if (!res.ok && res.status !== 404) {
      throw new Error(`Booksy cancel ${res.status}: ${await res.text()}`)
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!process.env.BOOKSY_API_KEY || !process.env.BOOKSY_BUSINESS_ID) {
      return { healthy: false, message: 'Booksy credentials missing' }
    }
    return { healthy: true }
  }
}
