// F0804: Persona compliance check

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface ComplianceResult {
  passed: boolean
  checks: {
    has_system_prompt: boolean
    has_disclaimer: boolean
    has_consent_message: boolean
    has_privacy_notice: boolean
    system_prompt_length_ok: boolean
  }
  warnings: string[]
  suggestions: string[]
}

const COMPLIANCE_KEYWORDS = {
  disclaimer: ['disclaimer', 'disclaim', 'authorized', 'permission'],
  consent: ['consent', 'agree', 'accept', 'understand'],
  privacy: ['privacy', 'data', 'personal information', 'confidential'],
}

function checkCompliance(systemPrompt: string): ComplianceResult {
  const lowerPrompt = systemPrompt.toLowerCase()
  const warnings: string[] = []
  const suggestions: string[] = []

  // Check system prompt exists
  const hasSystemPrompt = !!systemPrompt && systemPrompt.length > 0

  // Check for disclaimer
  const hasDisclaimer = COMPLIANCE_KEYWORDS.disclaimer.some((kw) =>
    lowerPrompt.includes(kw)
  )
  if (!hasDisclaimer) {
    warnings.push('Missing disclaimer about AI nature of agent')
    suggestions.push('Add a disclaimer: "I am an AI assistant and..."')
  }

  // Check for consent message
  const hasConsent = COMPLIANCE_KEYWORDS.consent.some((kw) =>
    lowerPrompt.includes(kw)
  )
  if (!hasConsent) {
    warnings.push('Missing consent/agreement message')
    suggestions.push('Include message about caller agreement to speak with AI')
  }

  // Check for privacy notice
  const hasPrivacy = COMPLIANCE_KEYWORDS.privacy.some((kw) =>
    lowerPrompt.includes(kw)
  )
  if (!hasPrivacy) {
    warnings.push('No privacy notice detected')
    suggestions.push('Add privacy statement about data handling')
  }

  // Check system prompt length
  const systemPromptLengthOk = hasSystemPrompt && systemPrompt.length >= 50

  return {
    passed: hasSystemPrompt && hasDisclaimer && hasConsent,
    checks: {
      has_system_prompt: hasSystemPrompt,
      has_disclaimer: hasDisclaimer,
      has_consent_message: hasConsent,
      has_privacy_notice: hasPrivacy,
      system_prompt_length_ok: systemPromptLengthOk,
    },
    warnings,
    suggestions,
  }
}

// GET /api/personas/:id/compliance-check - Check persona compliance
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    let query = supabaseAdmin
      .from('personas')
      .select('id, system_prompt')
      .eq('id', params.id)

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data: persona, error } = await query.single()

    if (error || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    const complianceResult = checkCompliance(persona.system_prompt || '')

    return NextResponse.json({
      persona_id: params.id,
      compliance: complianceResult,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error checking compliance:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/personas/:id/compliance-check - Run compliance check and save result
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    let query = supabaseAdmin
      .from('personas')
      .select('id, system_prompt')
      .eq('id', params.id)

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data: persona, error } = await query.single()

    if (error || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    const complianceResult = checkCompliance(persona.system_prompt || '')

    // Store compliance result (optional - could be added to a compliance_checks table)
    return NextResponse.json({
      persona_id: params.id,
      compliance: complianceResult,
      timestamp: new Date().toISOString(),
      action_required: !complianceResult.passed,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error running compliance check:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
