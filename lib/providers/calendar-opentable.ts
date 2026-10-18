/**
 * CalendarProvider adapter for OpenTable (restaurant reservations).
 *
 * OpenTable's reservation API (Connect / GuestCenter Partner API) is
 * partner-gated. Public surface enables availability lookups + reservation
 * creation against a restaurant_id. We model it shaped like the other
 * adapters; tenants supply their partner credentials.
 *
 * Endpoints (OpenTable Reservation API v3):
 *   GET  /reservation/v3/restaurants/{rid}/availability
 *   POST /reservation/v3/restaurants/{rid}/reservations
 *   PATCH /reservation/v3/reservations/{id}/cancel
 *
 * Env:
 *   OPENTABLE_API_KEY
 *   OPENTABLE_RESTAURANT_ID
 */

import type {
  CalendarProvider,
  CalendarSlot,
  CalendarBookingInput,
  CalendarBooking,
  ProviderHealth,
} from './types'

const BASE = 'https://platform.opentable.com'

interface OtEnv {
  apiKey: string
  restaurantId: string
}

function readEnv(): OtEnv {
  const apiKey = process.env.OPENTABLE_API_KEY
  const restaurantId = process.env.OPENTABLE_RESTAURANT_ID
  if (!apiKey || !restaurantId) {
    throw new Error('OPENTABLE_API_KEY and OPENTABLE_RESTAURANT_ID required')
  }
  return { apiKey, restaurantId }
}

function authHeaders(env: OtEnv): Record<string, string> {
  return {
    authorization: `Bearer ${env.apiKey}`,
    'content-type': 'application/json',
  }
}

export class OpenTableCalendar implements CalendarProvider {
  readonly slug = 'opentable'

  async listSlots(opts: {
    eventTypeId?: string | number
    date: string
    partySize?: number
  }): Promise<CalendarSlot[]> {
    const env = readEnv()
    const partySize = opts.partySize ?? 2
    const url =
      `${BASE}/reservation/v3/restaurants/${env.restaurantId}/availability` +
      `?date=${encodeURIComponent(opts.date)}` +
      `&party_size=${partySize}`

    const res = await fetch(url, { headers: authHeaders(env) })
    if (!res.ok) throw new Error(`OpenTable availability ${res.status}: ${await res.text()}`)
    const data: any = await res.json()
    return (data?.times ?? data?.slots ?? []).map((s: any) => ({
      start: s.datetime ?? s.time ?? s.start,
      end: s.datetime_end ?? s.end ?? s.time,
      available: s.available !== false,
    }))
  }

  async bookSlot(input: CalendarBookingInput): Promise<CalendarBooking> {
    const env = readEnv()
    const body = {
      datetime: new Date(input.start).toISOString(),
      party_size: (input.metadata as any)?.partySize ?? 2,
      guest: {
        first_name: input.attendeeName.split(' ')[0],
        last_name: input.attendeeName.split(' ').slice(1).join(' ') || '-',
        email: input.attendeeEmail,
        phone: input.attendeePhone,
      },
      notes: input.notes,
      special_requests: (input.metadata as any)?.specialRequests,
    }
    const res = await fetch(
      `${BASE}/reservation/v3/restaurants/${env.restaurantId}/reservations`,
      {
        method: 'POST',
        headers: authHeaders(env),
        body: JSON.stringify(body),
      },
    )
    if (!res.ok) throw new Error(`OpenTable reserve ${res.status}: ${await res.text()}`)
    const data: any = await res.json()
    return {
      id: String(data?.reservation?.id ?? data?.id ?? ''),
      start: data?.reservation?.datetime ?? input.start,
      end: input.end ?? input.start,
      status: 'confirmed',
      raw: data,
    }
  }

  async cancelBooking(id: string, reason?: string): Promise<void> {
    const env = readEnv()
    const res = await fetch(
      `${BASE}/reservation/v3/reservations/${encodeURIComponent(id)}/cancel`,
      {
        method: 'PATCH',
        headers: authHeaders(env),
        body: JSON.stringify({ reason: reason ?? 'cancelled by agent' }),
      },
    )
    if (!res.ok && res.status !== 404) {
      throw new Error(`OpenTable cancel ${res.status}: ${await res.text()}`)
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    return process.env.OPENTABLE_API_KEY && process.env.OPENTABLE_RESTAURANT_ID
      ? { healthy: true }
      : { healthy: false, message: 'OpenTable credentials missing' }
  }
}
