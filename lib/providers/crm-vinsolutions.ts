/**
 * CRMProvider implementation for VinSolutions (Cox Automotive).
 *
 * Used by the dealership_bdc pack for lead lookup + lead creation against
 * dealer CRM. VinSolutions exposes the partner-API at:
 *   https://api.vinsolutions.com/<dealerId>/leads
 *   https://api.vinsolutions.com/<dealerId>/contacts
 *
 * Auth is dealer-scoped: VinSolutions issues an API key per integrator,
 * combined with a dealer_id (CRM tenant inside the partner account). We
 * keep the surface small — lookupByPhone + upsertContact — because the
 * pack persona only needs CRM presence + a place to file the inbound
 * lead. Test-drive bookings go through the calendar provider; service
 * bookings go through the service-software provider; this is just the
 * lead-of-record write.
 *
 * Env (or per-tenant credentials):
 *   VINSOLUTIONS_API_KEY    — partner integrator key
 *   VINSOLUTIONS_DEALER_ID  — dealer/rooftop identifier
 *   VINSOLUTIONS_HOST       — defaults to https://api.vinsolutions.com
 */

import type { CRMProvider, CRMContact, ProviderHealth } from './types'

interface VinEnv {
  apiKey: string
  dealerId: string
  host: string
}

function readEnv(creds?: Record<string, string>): VinEnv {
  const apiKey = creds?.api_key ?? process.env.VINSOLUTIONS_API_KEY
  const dealerId = creds?.dealer_id ?? process.env.VINSOLUTIONS_DEALER_ID
  const host = creds?.host ?? process.env.VINSOLUTIONS_HOST ?? 'https://api.vinsolutions.com'
  if (!apiKey) throw new Error('VinSolutions requires api_key (VINSOLUTIONS_API_KEY or per-tenant)')
  if (!dealerId) throw new Error('VinSolutions requires dealer_id (VINSOLUTIONS_DEALER_ID or per-tenant)')
  return { apiKey, dealerId, host }
}

function authHeaders(env: VinEnv): Record<string, string> {
  return {
    authorization: `Bearer ${env.apiKey}`,
    'x-dealer-id': env.dealerId,
    'content-type': 'application/json',
    accept: 'application/json',
  }
}

function decodeContact(c: any): CRMContact {
  return {
    id: String(c.id ?? c.contactId ?? ''),
    firstName: c.firstName ?? c.first_name,
    lastName: c.lastName ?? c.last_name,
    phone: c.phone ?? c.cellPhone ?? c.homePhone,
    email: c.email,
    metadata: {
      leadId: c.leadId,
      leadSource: c.leadSource,
      leadStatus: c.leadStatus,
      assignedSalesperson: c.assignedSalespersonName,
      lastActivityAt: c.lastActivityAt,
      raw: c,
    },
  }
}

export class VinSolutionsCRM implements CRMProvider {
  readonly slug = 'vinsolutions'
  private creds?: Record<string, string>

  constructor(creds?: Record<string, string>) {
    this.creds = creds
  }

  private env() {
    return readEnv(this.creds)
  }

  async lookupByPhone(phone: string): Promise<CRMContact | null> {
    const env = this.env()
    const url =
      `${env.host}/${encodeURIComponent(env.dealerId)}/contacts` +
      `?phone=${encodeURIComponent(phone)}&limit=1`
    const res = await fetch(url, { headers: authHeaders(env) })
    if (!res.ok) return null
    const data: any = await res.json()
    const arr = (data?.data ?? data?.contacts ?? []) as any[]
    const first = arr[0]
    return first ? decodeContact(first) : null
  }

  async upsertContact(contact: Partial<CRMContact> & { phone: string }): Promise<CRMContact> {
    const env = this.env()
    const existing = await this.lookupByPhone(contact.phone).catch(() => null)
    const body = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      email: contact.email,
      leadSource: contact.metadata?.leadSource ?? 'AI Voice Assistant',
      // Dealership leads usually carry a department + vehicle interest;
      // pack tools pass these through metadata when available.
      department: contact.metadata?.department,
      vehicleOfInterest: contact.metadata?.vehicleOfInterest,
      notes: contact.metadata?.notes,
    }

    if (existing?.id) {
      const res = await fetch(
        `${env.host}/${encodeURIComponent(env.dealerId)}/contacts/${encodeURIComponent(existing.id)}`,
        { method: 'PATCH', headers: authHeaders(env), body: JSON.stringify(body) },
      )
      if (!res.ok) throw new Error(`VinSolutions update ${res.status}: ${await res.text()}`)
      const data: any = await res.json()
      return decodeContact(data?.data ?? data ?? { ...body, id: existing.id })
    }

    const res = await fetch(
      `${env.host}/${encodeURIComponent(env.dealerId)}/leads`,
      { method: 'POST', headers: authHeaders(env), body: JSON.stringify(body) },
    )
    if (!res.ok) throw new Error(`VinSolutions create ${res.status}: ${await res.text()}`)
    const data: any = await res.json()
    return decodeContact(data?.data ?? data ?? body)
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
