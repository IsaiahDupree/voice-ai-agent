import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { formatE164, validatePhoneNumber } from '@/lib/sms'

export async function POST(
  request: NextRequest,
  { params }: { params: { phone: string } }
) {
  try {
    const rawPhone = decodeURIComponent(params.phone)
    const phone = formatE164(rawPhone)

    if (!validatePhoneNumber(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    let reason = 'manual_suppression'
    let source = 'api'
    try {
      const body = await request.json()
      if (body.reason) reason = body.reason
      if (body.source) source = body.source
    } catch {
      // No body is fine, use defaults
    }

    // Check if already suppressed
    const { data: existing } = await supabaseAdmin
      .from('localreach_suppression_list')
      .select('id')
      .eq('phone', phone)
      .single()

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadySuppressed: true,
        message: `${phone} is already on the suppression list`,
      })
    }

    // Add to suppression list
    const { data, error } = await supabaseAdmin
      .from('localreach_suppression_list')
      .insert({
        phone,
        reason,
        source,
        added_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    // Also add to the global DNC list for cross-system compliance
    await supabaseAdmin
      .from('voice_agent_dnc')
      .upsert(
        {
          phone_number: phone,
          reason: `localreach_suppression: ${reason}`,
          added_at: new Date().toISOString(),
        },
        { onConflict: 'phone_number' }
      )

    return NextResponse.json({
      success: true,
      alreadySuppressed: false,
      suppression: data,
      message: `${phone} added to suppression list`,
    })
  } catch (error: any) {
    console.error('[Suppress Phone API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to suppress phone number' },
      { status: 500 }
    )
  }
}
