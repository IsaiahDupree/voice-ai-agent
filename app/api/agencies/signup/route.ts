/**
 * /api/agencies/signup — kick off agency signup via Stripe Checkout.
 *
 * Body: { agencyName, agencySlug, contactEmail, plan }
 * Returns: { url, sessionId }
 *
 * The actual agency record is created by the Stripe webhook
 * (/api/webhooks/stripe) on checkout.session.completed. This keeps
 * provisioning idempotent — we never create an agency for a customer
 * who didn't actually pay.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSignupCheckoutSession, type Plan } from '@/lib/billing'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  const { agencyName, agencySlug, contactEmail, plan } = body
  if (!agencyName || !agencySlug || !contactEmail || !plan) {
    return NextResponse.json(
      { error: 'agencyName, agencySlug, contactEmail, plan required' },
      { status: 400 },
    )
  }
  if (!['starter', 'growth', 'scale'].includes(plan)) {
    return NextResponse.json({ error: 'invalid plan (use starter/growth/scale)' }, { status: 400 })
  }

  // Slug pre-flight — the webhook will fail downstream if a duplicate
  // slug already exists, so catch it cheaply before spending a Stripe
  // session.
  const { data: existing } = await supabaseAdmin
    .from('agencies')
    .select('id')
    .eq('slug', agencySlug)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'slug_taken' }, { status: 409 })
  }

  const origin =
    req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const { url, sessionId } = await createSignupCheckoutSession({
      agencyName,
      agencySlug,
      contactEmail,
      plan: plan as Plan,
      successUrl: `${origin}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/signup?cancelled=1`,
    })
    return NextResponse.json({ url, sessionId })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'checkout failed' }, { status: 500 })
  }
}
