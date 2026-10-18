/**
 * CalendarProvider implementation for Calendly.
 *
 * Uses Calendly API v2:
 *   GET  /event_types/{uuid}/available_times      → listSlots
 *   POST /scheduling_links                        → bookSlot (single-use link)
 *   POST /scheduled_events/{uuid}/cancellation    → cancelBooking
 *
 * Note: Calendly's public API does NOT expose direct programmatic booking
 * for arbitrary attendees the way Cal.com does. The supported pattern is
 * to mint a single-use scheduling_link the agent can SMS/email and have
 * the caller complete. We surface this as a "pending" booking with the
 * scheduling URL in raw — pack tools should then sendSMS the link.
 *
 * Env:
 *   CALENDLY_API_TOKEN      — Personal Access Token or OAuth token
 *   CALENDLY_DEFAULT_EVENT_TYPE_URI — fallback event type URI
 */

import type {
  CalendarProvider,
  CalendarSlot,
  CalendarBookingInput,
  CalendarBooking,
  ProviderHealth,
} from './types'

const BASE = 'https://api.calendly.com'

function authHeaders(): Record<string, string> {
  const tok = process.env.CALENDLY_API_TOKEN
  if (!tok) throw new Error('CALENDLY_API_TOKEN not configured')
  return {
    authorization: `Bearer ${tok}`,
    'content-type': 'application/json',
  }
}

function resolveEventTypeUri(eventTypeId?: string | number): string {
  const id = eventTypeId != null ? String(eventTypeId) : ''
  if (id.startsWith('https://')) return id
  if (id) return `https://api.calendly.com/event_types/${id}`
  const fallback = process.env.CALENDLY_DEFAULT_EVENT_TYPE_URI
  if (!fallback) throw new Error('No Calendly event type URI provided')
  return fallback
}

export class CalendlyCalendar implements CalendarProvider {
  readonly slug = 'calendly'

  async listSlots(opts: { eventTypeId?: string | number; date: string }): Promise<CalendarSlot[]> {
    const eventType = resolveEventTypeUri(opts.eventTypeId)
    // available_times requires start_time + end_time within a 7-day window.
    const start = new Date(`${opts.date}T00:00:00Z`)
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    const url =
      `${BASE}/event_type_available_times` +
      `?event_type=${encodeURIComponent(eventType)}` +
      `&start_time=${encodeURIComponent(start.toISOString())}` +
      `&end_time=${encodeURIComponent(end.toISOString())}`

    const res = await fetch(url, { headers: authHeaders() })
    if (!res.ok) throw new Error(`Calendly listSlots ${res.status}: ${await res.text()}`)
    const data: any = await res.json()
    return (data.collection ?? []).map((s: any) => ({
      start: s.start_time,
      end: s.end_time ?? s.start_time,
      available: s.status === 'available',
    }))
  }

  async bookSlot(input: CalendarBookingInput): Promise<CalendarBooking> {
    const eventTypeUri = resolveEventTypeUri(input.eventTypeId)
    // Calendly doesn't allow direct attendee booking; mint a single-use link.
    const res = await fetch(`${BASE}/scheduling_links`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        max_event_count: 1,
        owner: eventTypeUri,
        owner_type: 'EventType',
      }),
    })
    if (!res.ok) throw new Error(`Calendly scheduling_links ${res.status}: ${await res.text()}`)
    const data: any = await res.json()
    const bookingUrl: string = data?.resource?.booking_url ?? ''
    return {
      id: bookingUrl,
      start: input.start,
      end: input.end ?? input.start,
      status: 'pending',
      raw: { booking_url: bookingUrl, requires_caller_completion: true },
    }
  }

  async cancelBooking(id: string, reason?: string): Promise<void> {
    if (!id.includes('/scheduled_events/')) {
      // single-use link or unknown id; nothing to cancel server-side
      return
    }
    const res = await fetch(`${id}/cancellation`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reason: reason ?? 'cancelled by agent' }),
    })
    if (!res.ok && res.status !== 404) {
      throw new Error(`Calendly cancel ${res.status}: ${await res.text()}`)
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!process.env.CALENDLY_API_TOKEN) {
      return { healthy: false, message: 'CALENDLY_API_TOKEN missing' }
    }
    try {
      const res = await fetch(`${BASE}/users/me`, { headers: authHeaders() })
      return res.ok ? { healthy: true } : { healthy: false, message: `status ${res.status}` }
    } catch (e: any) {
      return { healthy: false, message: e?.message ?? 'unknown' }
    }
  }
}
