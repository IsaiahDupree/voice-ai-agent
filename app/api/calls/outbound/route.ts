import { NextRequest, NextResponse } from 'next/server'
import { startCall } from '@/lib/vapi'
import { supabaseAdmin } from '@/lib/supabase'
import { generateWhisperOverrides, generateWhisperFromContact, CallWhisperContext } from '@/lib/call-whisper'

// F0139: Call whisper to agent - Enhanced outbound call endpoint with automatic whisper context
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { assistantId, phoneNumberId, customerNumber, metadata, whisperContext } = body

    if (!assistantId) {
      return NextResponse.json(
        { error: 'assistantId is required' },
        { status: 400 }
      )
    }

    if (!customerNumber) {
      return NextResponse.json(
        { error: 'customerNumber is required for outbound calls' },
        { status: 400 }
      )
    }

    // F0139: Lookup contact from CRM and generate whisper context
    let finalWhisperContext: CallWhisperContext = whisperContext || {}

    if (!whisperContext) {
      // Auto-lookup contact if no whisper context provided
      const { data: contact } = await supabaseAdmin
        .from('voice_agent_contacts')
        .select('*')
        .eq('phone', customerNumber)
        .maybeSingle()

      if (contact) {
        // Generate whisper context from contact data
        finalWhisperContext = generateWhisperFromContact(contact)

        // Add additional context if available
        const { data: recentCalls } = await supabaseAdmin
          .from('voice_agent_calls')
          .select('call_reason, created_at')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false })
          .limit(3)

        if (recentCalls && recentCalls.length > 0) {
          const callSummary = recentCalls
            .map(c => `${c.call_reason || 'general inquiry'} (${new Date(c.created_at).toLocaleDateString()})`)
            .join(', ')
          finalWhisperContext.previousInteractions = callSummary
        }
      }
    }

    // Generate assistant overrides with whisper context
    // F0139: Context loaded before first word
    const assistantOverrides = generateWhisperOverrides(finalWhisperContext)

    // Add any additional metadata
    if (metadata) {
      assistantOverrides.metadata = {
        ...assistantOverrides.metadata,
        ...metadata,
        whisper_context_applied: true,
      }
    }

    // Initiate call with whisper context
    const call = await startCall({
      assistantId,
      phoneNumberId,
      customerNumber,
      assistantOverrides,
      metadata: {
        ...metadata,
        whisper_context: finalWhisperContext,
      },
    })

    // Log the outbound call with whisper context
    await supabaseAdmin.from('voice_agent_calls').insert({
      call_id: call.id,
      assistant_id: assistantId,
      status: 'queued',
      started_at: new Date().toISOString(),
      from_number: phoneNumberId,
      to_number: customerNumber,
      direction: 'outbound',
      metadata: {
        whisper_context: finalWhisperContext,
        call,
      },
    })

    return NextResponse.json({
      success: true,
      call,
      whisper_context_applied: Object.keys(finalWhisperContext).length > 0,
      whisper_fields: Object.keys(finalWhisperContext),
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error initiating outbound call with whisper:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to initiate outbound call',
        code: error.code,
      },
      { status: error.statusCode || 500 }
    )
  }
}
