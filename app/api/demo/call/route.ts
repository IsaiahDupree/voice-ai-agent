import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const VAPI_API_KEY    = process.env.VAPI_API_KEY!
  const ASSISTANT_ID    = process.env.VAPI_ASSISTANT_ID!
  const PHONE_NUMBER_ID = process.env.VAPI_PHONE_ID!
  try {
    const { phone, domain } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 })
    }

    // Build assistant overrides — inject business context if a domain was crawled
    const assistantOverrides: Record<string, unknown> = {}
    if (domain) {
      // Pull the brief from the business-context API
      try {
        const base = request.nextUrl.origin
        const briefRes = await fetch(`${base}/api/business-context?domain=${encodeURIComponent(domain)}`)
        if (briefRes.ok) {
          const brief = await briefRes.json()
          assistantOverrides.variableValues = {
            business_context: brief.brief ?? '',
            company_name:     brief.company_name ?? domain,
            services:         brief.services_summary ?? '',
            brand_tone:       brief.brand_tone ?? '',
          }
        }
      } catch {
        // Non-fatal — proceed without business context
      }
    }

    const vapiBody: Record<string, unknown> = {
      assistantId:   ASSISTANT_ID,
      phoneNumberId: PHONE_NUMBER_ID,
      customer: { number: phone },
    }
    if (Object.keys(assistantOverrides).length > 0) {
      vapiBody.assistantOverrides = assistantOverrides
    }

    const res = await fetch('https://api.vapi.ai/call', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(vapiBody),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || data.error || `Vapi error ${res.status}` },
        { status: res.status }
      )
    }

    return NextResponse.json({ callId: data.id, status: data.status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[demo/call]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
