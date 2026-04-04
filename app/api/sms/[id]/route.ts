// F0935: GET /api/sms/:id - Returns single SMS record
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/sms/:id
 * F0935: Returns single SMS record detail
 *
 * Returns full SMS log including:
 * - to/from numbers
 * - body content
 * - status, delivery time
 * - error code/message if failed
 * - linked contact/call/campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const smsId = parseInt(params.id)

    if (isNaN(smsId)) {
      return NextResponse.json(
        { error: 'Invalid SMS ID' },
        { status: 400 }
      )
    }

    const { data: sms, error } = await supabaseAdmin
      .from('voice_agent_sms_logs')
      .select('*')
      .eq('id', smsId)
      .single()

    if (error || !sms) {
      return NextResponse.json(
        { error: 'SMS not found' },
        { status: 404 }
      )
    }

    // Optionally join contact/call/campaign if IDs are present
    if (sms.contact_id) {
      const { data: contact } = await supabaseAdmin
        .from('voice_agent_contacts')
        .select('id, name, phone, email')
        .eq('id', sms.contact_id)
        .single()

      if (contact) {
        sms.contact = contact
      }
    }

    if (sms.call_id) {
      const { data: call } = await supabaseAdmin
        .from('voice_agent_calls')
        .select('id, call_id, status, duration_seconds')
        .eq('call_id', sms.call_id)
        .single()

      if (call) {
        sms.call = call
      }
    }

    if (sms.campaign_id) {
      const { data: campaign } = await supabaseAdmin
        .from('voice_agent_campaigns')
        .select('id, name, status')
        .eq('id', sms.campaign_id)
        .single()

      if (campaign) {
        sms.campaign = campaign
      }
    }

    return NextResponse.json(sms)
  } catch (error: any) {
    console.error('[SMS Detail API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get SMS' },
      { status: 500 }
    )
  }
}
