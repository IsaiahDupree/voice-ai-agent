/**
 * POST /api/business-context/webhook — Vapi end-of-call-report handler
 * Extracts CallOutcome via Claude and stores in call_outcomes table
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

const anthropic = new Anthropic()

const OUTCOME_PROMPT = `Analyze this Vapi end-of-call report and extract a structured call outcome as JSON.

Return ONLY valid JSON matching this schema — no markdown, no code fences:
{
  "outcome": "string — one of: booked, interested, not_interested, no_answer, voicemail, callback_requested, objection, other",
  "pain_points_mentioned": ["pain points the prospect mentioned during the call"],
  "objections_raised": ["objections the prospect raised"],
  "next_step": "string — what should happen next",
  "booking_confirmed": false,
  "follow_up_needed": false,
  "notes": "string — brief summary of the call"
}`

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()

    // Vapi end-of-call-report structure
    const {
      message,
    } = payload as {
      message?: {
        type?: string
        call?: {
          id?: string
          customer?: { number?: string }
          assistantId?: string
          duration?: number
        }
        transcript?: string
        summary?: string
        recordingUrl?: string
      }
    }

    if (message?.type !== 'end-of-call-report') {
      return NextResponse.json({ received: true, skipped: 'not end-of-call-report' })
    }

    const call = message.call
    const callId = call?.id
    const duration = call?.duration
    const prospectNumber = call?.customer?.number

    // Build context for extraction
    const callContext = [
      message.summary ? `Summary: ${message.summary}` : '',
      message.transcript ? `Transcript:\n${message.transcript}` : '',
    ].filter(Boolean).join('\n\n')

    if (!callContext) {
      return NextResponse.json({ received: true, skipped: 'no transcript or summary' })
    }

    // Extract outcome via Claude
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      temperature: 0,
      system: OUTCOME_PROMPT,
      messages: [{ role: 'user', content: callContext }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    const jsonStr = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim()
    let outcome
    try {
      outcome = JSON.parse(jsonStr)
    } catch {
      outcome = {
        outcome: 'other',
        pain_points_mentioned: [],
        objections_raised: [],
        next_step: 'Review transcript manually',
        booking_confirmed: false,
        follow_up_needed: true,
        notes: 'Failed to parse outcome from transcript',
      }
    }

    // Look up business_id from assistant if possible
    let businessId = null
    // We could look this up from assistant metadata, but for now leave nullable

    // Store in call_outcomes
    await supabaseAdmin.from('call_outcomes').insert({
      call_id: callId || `unknown-${Date.now()}`,
      business_id: businessId,
      prospect_number: prospectNumber || null,
      duration_seconds: duration || null,
      outcome: outcome.outcome,
      pain_points_mentioned: outcome.pain_points_mentioned,
      objections_raised: outcome.objections_raised,
      next_step: outcome.next_step,
      booking_confirmed: outcome.booking_confirmed,
      follow_up_needed: outcome.follow_up_needed,
      notes: outcome.notes,
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[business-context/webhook] Error:', error)
    return NextResponse.json({ received: true, error: 'Processing failed' }, { status: 500 })
  }
}
