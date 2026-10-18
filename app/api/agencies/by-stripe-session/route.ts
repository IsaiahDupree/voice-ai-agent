/**
 * /api/agencies/by-stripe-session?session_id=...
 *
 * Resolves a Stripe Checkout Session id back to the provisioned agency
 * (after the webhook lands). Used by /signup/success to know when to
 * redirect into the dashboard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripeClient } from '@/lib/billing'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 })
  }
  let session: any
  try {
    session = await stripeClient().checkout.sessions.retrieve(sessionId)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'session_not_found' }, { status: 404 })
  }
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id
  if (!customerId) {
    return NextResponse.json({ agency: null })
  }
  const { data } = await supabaseAdmin
    .from('agencies')
    .select('id, slug, name, plan, status, max_clients')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return NextResponse.json({ agency: data ?? null })
}
