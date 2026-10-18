/**
 * PMSProvider implementation for Open Dental.
 *
 * Open Dental's REST API ships with the server install (port 30225 by
 * default) and authenticates via Developer + Customer keys.
 *
 * Endpoints used:
 *   GET  /patients/Methods/GetByPhone
 *   GET  /patients/Methods/GetByName
 *   GET  /appointments?PatNum=
 *   POST /appointments
 *   PUT  /appointments/{id}/Cancel
 *   GET  /recalls?PatNum=  → derives recallType + recallIntervalMonths
 *
 * Env (or per-tenant credentials):
 *   OPEN_DENTAL_BASE_URL
 *   OPEN_DENTAL_DEVELOPER_KEY
 *   OPEN_DENTAL_CUSTOMER_KEY
 */

import type {
  PMSProvider,
  PMSPatient,
  PMSAppointment,
  ProviderHealth,
} from './types'

interface OdEnv {
  baseUrl: string
  developerKey: string
  customerKey: string
}

function readEnv(creds?: Record<string, string>): OdEnv {
  const baseUrl = creds?.base_url ?? process.env.OPEN_DENTAL_BASE_URL
  const developerKey = creds?.developer_key ?? process.env.OPEN_DENTAL_DEVELOPER_KEY
  const customerKey = creds?.customer_key ?? process.env.OPEN_DENTAL_CUSTOMER_KEY
  if (!baseUrl || !developerKey || !customerKey) {
    throw new Error('Open Dental requires base_url + developer_key + customer_key')
  }
  return { baseUrl, developerKey, customerKey }
}

function authHeaders(env: OdEnv): Record<string, string> {
  return {
    authorization: `ODFHIR ${env.developerKey}/${env.customerKey}`,
    'content-type': 'application/json',
  }
}

const RECALL_TYPE_MAP: Record<string, { type: string; intervalMonths: number }> = {
  D1110: { type: 'prophy', intervalMonths: 6 },
  D4910: { type: 'perio_maintenance', intervalMonths: 3 },
  D1120: { type: 'prophy_child', intervalMonths: 6 },
  D0150: { type: 'comprehensive_exam', intervalMonths: 12 },
}

function decodePatient(p: any): PMSPatient {
  return {
    id: String(p.PatNum ?? p.id ?? ''),
    firstName: p.FName ?? p.firstName,
    lastName: p.LName ?? p.lastName,
    dob: p.Birthdate ?? p.dob,
    phone: p.HmPhone ?? p.WkPhone ?? p.WirelessPhone ?? p.phone,
    email: p.Email ?? p.email,
    status: ((p.PatStatus ?? p.status) === 'Patient' ? 'active' : 'inactive') as any,
    metadata: p,
  }
}

function decodeAppointment(a: any): PMSAppointment {
  const status = String(a.AptStatus ?? a.status ?? 'Scheduled').toLowerCase()
  const map: Record<string, PMSAppointment['status']> = {
    scheduled: 'scheduled',
    complete: 'completed',
    completed: 'completed',
    broken: 'cancelled',
    cancelled: 'cancelled',
    unscheduled: 'cancelled',
    no_show: 'no_show',
    asap: 'scheduled',
  }
  return {
    id: String(a.AptNum ?? a.id ?? ''),
    patientId: String(a.PatNum ?? a.patientId ?? ''),
    providerId: a.ProvNum ? String(a.ProvNum) : undefined,
    start: a.AptDateTime ?? a.start,
    end: a.AptEnd ?? a.end ?? a.AptDateTime,
    appointmentType: a.ProcDescript ?? a.appointmentType,
    status: map[status] ?? 'scheduled',
  }
}

export class OpenDentalPMS implements PMSProvider {
  readonly slug = 'open_dental'
  private creds?: Record<string, string>

  constructor(creds?: Record<string, string>) {
    this.creds = creds
  }

  private env() {
    return readEnv(this.creds)
  }

  async lookupPatientByPhone(phone: string): Promise<PMSPatient | null> {
    const env = this.env()
    const res = await fetch(
      `${env.baseUrl}/patients?Phone=${encodeURIComponent(phone)}`,
      { headers: authHeaders(env) },
    )
    if (!res.ok) return null
    const data: any = await res.json()
    const arr = Array.isArray(data) ? data : data?.patients ?? []
    const first = arr[0]
    if (!first) return null
    return await this.enrichRecall(decodePatient(first))
  }

  async lookupPatientByIdentity(input: {
    firstName: string
    lastName: string
    dob: string
  }): Promise<PMSPatient | null> {
    const env = this.env()
    const url =
      `${env.baseUrl}/patients` +
      `?LName=${encodeURIComponent(input.lastName)}` +
      `&FName=${encodeURIComponent(input.firstName)}` +
      `&Birthdate=${encodeURIComponent(input.dob)}`
    const res = await fetch(url, { headers: authHeaders(env) })
    if (!res.ok) return null
    const data: any = await res.json()
    const arr = Array.isArray(data) ? data : data?.patients ?? []
    if (arr.length === 0) return null
    return await this.enrichRecall(decodePatient(arr[0]))
  }

  async listAppointments(patientId: string, opts?: { since?: string }): Promise<PMSAppointment[]> {
    const env = this.env()
    const since = opts?.since ? `&dateStart=${encodeURIComponent(opts.since)}` : ''
    const res = await fetch(
      `${env.baseUrl}/appointments?PatNum=${encodeURIComponent(patientId)}${since}`,
      { headers: authHeaders(env) },
    )
    if (!res.ok) return []
    const data: any = await res.json()
    const arr = Array.isArray(data) ? data : data?.appointments ?? []
    return arr.map(decodeAppointment)
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
      PatNum: Number(input.patientId),
      ProvNum: input.providerId ? Number(input.providerId) : undefined,
      AptDateTime: input.start,
      AptEnd: input.end,
      ProcDescript: input.appointmentType,
      Note: input.notes,
    }
    const res = await fetch(`${env.baseUrl}/appointments`, {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Open Dental create ${res.status}: ${await res.text()}`)
    const data: any = await res.json()
    return decodeAppointment(data)
  }

  async cancelAppointment(id: string, reason?: string): Promise<void> {
    const env = this.env()
    const res = await fetch(
      `${env.baseUrl}/appointments/${encodeURIComponent(id)}/Break`,
      {
        method: 'PUT',
        headers: authHeaders(env),
        body: JSON.stringify({ Note: reason ?? 'cancelled by agent' }),
      },
    )
    if (!res.ok && res.status !== 404) {
      throw new Error(`Open Dental cancel ${res.status}: ${await res.text()}`)
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

  private async enrichRecall(patient: PMSPatient): Promise<PMSPatient> {
    try {
      const env = this.env()
      const res = await fetch(
        `${env.baseUrl}/recalls?PatNum=${encodeURIComponent(patient.id)}`,
        { headers: authHeaders(env) },
      )
      if (!res.ok) return patient
      const data: any = await res.json()
      const arr = Array.isArray(data) ? data : data?.recalls ?? []
      const first = arr[0]
      if (!first) return patient
      const code = String(first.RecallType ?? first.code ?? '').toUpperCase()
      const mapped = RECALL_TYPE_MAP[code]
      return {
        ...patient,
        recallType: mapped?.type ?? code.toLowerCase(),
        recallIntervalMonths: first.RecallInterval ?? mapped?.intervalMonths,
        lastVisitAt: first.DatePrevious ?? patient.lastVisitAt,
      }
    } catch {
      return patient
    }
  }
}
