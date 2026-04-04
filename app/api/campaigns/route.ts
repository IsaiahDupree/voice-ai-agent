import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0177: Campaign create - Create a new outbound calling campaign

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      assistantId,
      callingHoursStart = '09:00',
      callingHoursEnd = '17:00',
      callingHoursTimezone = 'America/New_York',
      maxCallsPerDay,
      voicemailMessage,
      batchSize = 10,
      // F0197-F0243: New campaign fields
      voicemailDetection = true, // F0197
      voicemailDropUrl, // F0198: URL for pre-recorded voicemail message
      retryEnabled = true, // F0203
      retryMax = 3, // F0204
      retryOnNoAnswer = true, // F0206
      retryOnVoicemail = false,
      retryExclusionOnBooked = true, // F0209
      tcpaCompliance = true, // F0226
      firstMessage, // F0242: Campaign-specific greeting
      scriptVariables, // F0223: Variables to inject into script
    } = body

    if (!name || !assistantId) {
      return NextResponse.json(
        { error: 'name and assistantId are required' },
        { status: 400 }
      )
    }

    // F0189-F0191: Calling hours configuration
    const callingWindow = {
      start: callingHoursStart,
      end: callingHoursEnd,
      timezone: callingHoursTimezone,
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .insert({
        name,
        assistant_id: assistantId,
        status: 'draft', // draft, active, paused, completed
        calling_window: callingWindow,
        max_calls_per_day: maxCallsPerDay,
        voicemail_message: voicemailMessage,
        voicemail_detection: voicemailDetection, // F0197
        voicemail_drop_url: voicemailDropUrl, // F0198
        retry_enabled: retryEnabled, // F0203
        retry_max: retryMax, // F0204
        retry_on_no_answer: retryOnNoAnswer, // F0206
        retry_on_voicemail: retryOnVoicemail,
        retry_exclusion_on_booked: retryExclusionOnBooked, // F0209
        tcpa_compliance: tcpaCompliance, // F0226
        first_message: firstMessage, // F0242
        script_variables: scriptVariables, // F0223
        metadata: {
          batch_size: batchSize, // F0188: Batch size config
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(
      {
        success: true,
        campaign: data,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create campaign' },
      { status: 500 }
    )
  }
}

// List campaigns
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabaseAdmin
      .from('voice_agent_campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      campaigns: data || [],
    })
  } catch (error: any) {
    console.error('Error listing campaigns:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list campaigns' },
      { status: 500 }
    )
  }
}
