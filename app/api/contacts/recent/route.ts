// F0601: Contact recent list - returns last 10 contacted

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

interface RecentContact {
  id: string
  phone: string
  name: string
  email: string | null
  company: string | null
  last_contact_at: string
  last_contact_type: 'call' | 'sms'
  total_interactions: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Get recent calls with contact info
    const { data: recentCalls, error: callsError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('customer_phone, created_at')
      .order('created_at', { ascending: false })
      .limit(100) // Get more than we need to deduplicate

    if (callsError) {
      throw callsError
    }

    // Get recent SMS
    const { data: recentSMS, error: smsError } = await supabaseAdmin
      .from('voice_agent_sms_logs')
      .select('to_phone, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (smsError) {
      throw smsError
    }

    // Combine and sort by most recent interaction
    const interactions: Array<{ phone: string; timestamp: string; type: 'call' | 'sms' }> = [
      ...(recentCalls?.map((c) => ({
        phone: c.customer_phone,
        timestamp: c.created_at,
        type: 'call' as const,
      })) || []),
      ...(recentSMS?.map((s) => ({
        phone: s.to_phone,
        timestamp: s.created_at,
        type: 'sms' as const,
      })) || []),
    ]

    interactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Get unique phones and their last interaction
    const phoneMap = new Map<
      string,
      { timestamp: string; type: 'call' | 'sms'; count: number }
    >()

    interactions.forEach((interaction) => {
      if (!phoneMap.has(interaction.phone)) {
        phoneMap.set(interaction.phone, {
          timestamp: interaction.timestamp,
          type: interaction.type,
          count: 1,
        })
      } else {
        const existing = phoneMap.get(interaction.phone)!
        existing.count++
      }
    })

    // Take top N by most recent
    const topPhones = Array.from(phoneMap.entries())
      .sort((a, b) => new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime())
      .slice(0, limit)

    // Get contact details
    const phones = topPhones.map((entry) => entry[0])

    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('id, phone, name, email, company')
      .in('phone', phones)

    if (contactsError) {
      throw contactsError
    }

    // Build result with contact details
    const recentContacts: RecentContact[] = topPhones
      .map(([phone, info]) => {
        const contact = contacts?.find((c) => c.phone === phone)

        if (!contact) {
          // Contact not in CRM, return minimal info
          return {
            id: '',
            phone,
            name: 'Unknown',
            email: null,
            company: null,
            last_contact_at: info.timestamp,
            last_contact_type: info.type,
            total_interactions: info.count,
          }
        }

        return {
          id: contact.id,
          phone: contact.phone,
          name: contact.name || 'Unknown',
          email: contact.email,
          company: contact.company,
          last_contact_at: info.timestamp,
          last_contact_type: info.type,
          total_interactions: info.count,
        }
      })
      .filter((c) => c.id) // Only return contacts that exist in CRM

    return apiSuccess({
      contacts: recentContacts,
      total: recentContacts.length,
    })
  } catch (error: any) {
    console.error('Recent contacts error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to get recent contacts: ${error.message}`,
      500
    )
  }
}
