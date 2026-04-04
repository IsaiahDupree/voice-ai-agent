import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0160: Inbound API test - simulates an inbound call for testing webhook flow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      callerNumber = '+15555551234',
      assistantId = 'test-assistant-id',
      toNumber = '+15555559999',
    } = body

    // Simulate a call-started event
    const testCallId = `test-${Date.now()}`
    const testCall = {
      id: testCallId,
      assistantId,
      type: 'inbound',
      customer: { number: callerNumber },
      phoneNumber: { number: toNumber },
      status: 'in-progress',
    }

    // Look up contact (same flow as real webhook)
    const { data: contact } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('*')
      .eq('phone', callerNumber)
      .single()

    let greeting = null
    if (contact && contact.name) {
      const firstName = contact.name.split(' ')[0]
      greeting = `Hi ${firstName}! Thanks for calling.`
    }

    // Insert test call record
    const { data, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .insert({
        call_id: testCallId,
        assistant_id: assistantId,
        status: 'in-progress',
        started_at: new Date().toISOString(),
        from_number: callerNumber,
        to_number: toNumber,
        direction: 'inbound',
        contact_id: contact?.id,
        contact_name: contact?.name,
        personalized_greeting: greeting,
        is_emergency: false,
        metadata: {
          test: true,
          testCall,
        },
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(
      {
        success: true,
        message: 'Test inbound call created',
        call: data,
        contactFound: !!contact,
        greeting,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating test inbound call:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create test call' },
      { status: 500 }
    )
  }
}

// GET endpoint to verify test calls
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('*')
      .ilike('call_id', 'test-%')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      testCalls: data || [],
    })
  } catch (error: any) {
    console.error('Error fetching test calls:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch test calls' },
      { status: 500 }
    )
  }
}
