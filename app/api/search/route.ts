import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F1445: Global search API endpoint
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] })
    }

    const searchTerm = `%${query.trim()}%`
    const results: Array<{
      id: string
      type: 'call' | 'contact' | 'campaign'
      title: string
      subtitle?: string
      url: string
    }> = []

    // Search calls
    const { data: calls, error: callsError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('id, status, created_at, phone_number')
      .or(`status.ilike.${searchTerm},phone_number.ilike.${searchTerm}`)
      .limit(10)

    if (!callsError && calls) {
      calls.forEach((call) => {
        results.push({
          id: call.id,
          type: 'call',
          title: call.phone_number || 'Unknown',
          subtitle: `${call.status} • ${new Date(call.created_at).toLocaleDateString()}`,
          url: `/dashboard?callId=${call.id}`,
        })
      })
    }

    // Search contacts
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('contacts')
      .select('id, name, phone_number, email')
      .or(`name.ilike.${searchTerm},phone_number.ilike.${searchTerm},email.ilike.${searchTerm}`)
      .limit(10)

    if (!contactsError && contacts) {
      contacts.forEach((contact) => {
        results.push({
          id: contact.id,
          type: 'contact',
          title: contact.name || contact.phone_number,
          subtitle: contact.email || contact.phone_number,
          url: `/dashboard/contacts/${contact.id}`,
        })
      })
    }

    // Search campaigns
    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from('campaigns')
      .select('id, name, status')
      .ilike('name', searchTerm)
      .limit(10)

    if (!campaignsError && campaigns) {
      campaigns.forEach((campaign) => {
        results.push({
          id: campaign.id,
          type: 'campaign',
          title: campaign.name,
          subtitle: campaign.status,
          url: `/dashboard?campaignId=${campaign.id}`,
        })
      })
    }

    // Sort by relevance (exact matches first, then partial)
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase() === query.toLowerCase()
      const bExact = b.title.toLowerCase() === query.toLowerCase()
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return 0
    })

    return NextResponse.json({ results: results.slice(0, 20) })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed', results: [] },
      { status: 500 }
    )
  }
}
