/**
 * PMSProvider implementation for Clio Manage.
 *
 * Used by the legal_intake pack for conflict checks against contacts
 * (clients + opposing parties + related parties) and matters.
 *
 * Endpoints (Clio Manage API v4):
 *   GET  /api/v4/contacts.json?query=...
 *   GET  /api/v4/matters.json?client_id=
 *   GET  /api/v4/calendar_entries.json?from=&to=
 *   POST /api/v4/calendar_entries.json
 *
 * The "patient" abstraction maps to "contact" — slightly awkward but
 * keeps the PMSProvider interface universal across clinical + legal.
 *
 * Env (or per-tenant credentials):
 *   CLIO_API_TOKEN       — OAuth bearer (refresh out of band)
 *   CLIO_REGION_HOST     — defaults to https://app.clio.com
 */

import type {
  PMSProvider,
  PMSPatient,
  PMSAppointment,
  ProviderHealth,
} from './types'

interface ClioEnv {
  token: string
  host: string
}

function readEnv(creds?: Record<string, string>): ClioEnv {
  const token = creds?.api_token ?? process.env.CLIO_API_TOKEN
  const host = creds?.region_host ?? process.env.CLIO_REGION_HOST ?? 'https://app.clio.com'
  if (!token) throw new Error('Clio requires api_token (CLIO_API_TOKEN or per-tenant)')
  return { token, host }
}

function authHeaders(env: ClioEnv): Record<string, string> {
  return {
    authorization: `Bearer ${env.token}`,
    'x-api-version': '4.0.11',
    'content-type': 'application/json',
  }
}

function decodeContact(c: any): PMSPatient {
  const name: string = c.name ?? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
  const [first, ...rest] = name.split(/\s+/)
  return {
    id: String(c.id ?? ''),
    firstName: c.first_name ?? first,
    lastName: c.last_name ?? rest.join(' '),
    dob: c.date_of_birth,
    phone: c.primary_phone_number ?? c.phone,
    email: c.primary_email_address ?? c.email,
    status: c.is_client === false ? 'inactive' : 'active',
    metadata: { type: c.type, prefix: c.prefix, is_client: c.is_client },
  }
}

function decodeCalendarEntry(e: any): PMSAppointment {
  return {
    id: String(e.id ?? ''),
    patientId: String(e.matter?.client?.id ?? e.attendees?.[0]?.id ?? ''),
    providerId: e.calendar?.id ? String(e.calendar.id) : undefined,
    start: e.start_at ?? e.from,
    end: e.end_at ?? e.to ?? e.start_at,
    appointmentType: e.summary ?? e.event_type,
    status: 'scheduled',
  }
}

export class ClioPMS implements PMSProvider {
  readonly slug = 'clio'
  private creds?: Record<string, string>

  constructor(creds?: Record<string, string>) {
    this.creds = creds
  }

  private env() {
    return readEnv(this.creds)
  }

  async lookupPatientByPhone(phone: string): Promise<PMSPatient | null> {
    const env = this.env()
    // Clio search-by-phone goes through the contacts query parameter.
    const res = await fetch(
      `${env.host}/api/v4/contacts.json?query=${encodeURIComponent(phone)}&limit=1`,
      { headers: authHeaders(env) },
    )
    if (!res.ok) return null
    const data: any = await res.json()
    const arr = (data?.data ?? []) as any[]
    const first = arr[0]
    return first ? decodeContact(first) : null
  }

  async lookupPatientByIdentity(input: {
    firstName: string
    lastName: string
    dob: string
  }): Promise<PMSPatient | null> {
    const env = this.env()
    // Conflict-check semantics: fuzzy match across name. We don't filter
    // by DOB at the API because Clio doesn't always have it; the match
    // is name-driven and we rely on caller-provided DOB to break ties.
    const q = `${input.firstName} ${input.lastName}`.trim()
    const res = await fetch(
      `${env.host}/api/v4/contacts.json?query=${encodeURIComponent(q)}&limit=5`,
      { headers: authHeaders(env) },
    )
    if (!res.ok) return null
    const data: any = await res.json()
    const arr = (data?.data ?? []) as any[]
    if (arr.length === 0) return null

    // Prefer DOB match when both sides have one.
    if (input.dob) {
      const exact = arr.find(
        (c: any) => c.date_of_birth && c.date_of_birth.startsWith(input.dob),
      )
      if (exact) return decodeContact(exact)
    }
    return decodeContact(arr[0])
  }

  async listAppointments(patientId: string, opts?: { since?: string }): Promise<PMSAppointment[]> {
    const env = this.env()
    const from = opts?.since ?? new Date().toISOString()
    const url =
      `${env.host}/api/v4/calendar_entries.json` +
      `?from=${encodeURIComponent(from)}` +
      `&matter_client_id=${encodeURIComponent(patientId)}`

    const res = await fetch(url, { headers: authHeaders(env) })
    if (!res.ok) return []
    const data: any = await res.json()
    const arr = (data?.data ?? []) as any[]
    return arr.map(decodeCalendarEntry)
  }

  async createAppointment(input: {
    patientId: string
    providerId?: string
    start: string
    end: string
    appointmentType?: string
    notes?: string
  }): Promise<PMSAppointment> {
    const env = this.env()
    const body = {
      data: {
        summary: input.appointmentType ?? 'Voice intake — follow up',
        start_at: input.start,
        end_at: input.end,
        all_day: false,
        description: input.notes,
        attendees: [{ id: Number(input.patientId) }],
        calendar: input.providerId ? { id: Number(input.providerId) } : undefined,
      },
    }
    const res = await fetch(`${env.host}/api/v4/calendar_entries.json`, {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Clio create ${res.status}: ${await res.text()}`)
    const data: any = await res.json()
    return decodeCalendarEntry(data?.data ?? {})
  }

  async cancelAppointment(id: string, _reason?: string): Promise<void> {
    const env = this.env()
    const res = await fetch(
      `${env.host}/api/v4/calendar_entries/${encodeURIComponent(id)}.json`,
      { method: 'DELETE', headers: authHeaders(env) },
    )
    if (!res.ok && res.status !== 404) {
      throw new Error(`Clio cancel ${res.status}: ${await res.text()}`)
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      this.env()
      return { healthy: true }
    } catch (e: any) {
      return { healthy: false, message: e?.message ?? 'unknown' }
    }
  }
}
