import { supabaseAdmin } from '../supabase'
import type { CRMProvider, CRMContact, ProviderHealth } from './types'

export class SupabaseCRM implements CRMProvider {
  readonly slug = 'supabase'

  async lookupByPhone(phone: string): Promise<CRMContact | null> {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('*')
      .eq('phone', phone)
      .maybeSingle()
    if (error || !data) return null
    return {
      id: String(data.id),
      firstName: data.first_name ?? data.firstName,
      lastName: data.last_name ?? data.lastName,
      phone: data.phone,
      email: data.email,
      metadata: data,
    }
  }

  async upsertContact(contact: Partial<CRMContact> & { phone: string }): Promise<CRMContact> {
    const row = {
      phone: contact.phone,
      first_name: contact.firstName,
      last_name: contact.lastName,
      email: contact.email,
    }
    const { data, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .upsert(row, { onConflict: 'phone' })
      .select()
      .single()
    if (error) throw error
    return {
      id: String(data.id),
      firstName: data.first_name,
      lastName: data.last_name,
      phone: data.phone,
      email: data.email,
      metadata: data,
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const { error } = await supabaseAdmin.from('voice_agent_contacts').select('id').limit(1)
      return error ? { healthy: false, message: error.message } : { healthy: true }
    } catch (e: any) {
      return { healthy: false, message: e?.message ?? 'unknown' }
    }
  }
}
