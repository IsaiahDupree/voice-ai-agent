/**
 * /api/agencies/[id]/billing-portal — Stripe self-serve billing portal.
 *
 * The agency manages plan changes / payment method / cancellation
 * inside Stripe's hosted portal — we don't rebuild that UI. Returns the
 * portal URL for client-side redirect.
 *
 * POST { returnUrl?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAgencyById } from '@/lib/agency'
import { createBillingPortalSession } from '@/lib/billing'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const agency = await getAgencyById(params.id)
  if (!agency) {
    return NextResponse.json({ error: 'agency_not_found' }, { status: 404 })
  }
  if (!agency.stripe_customer_id) {
    return NextResponse.json(
      { error: 'no_stripe_customer', hint: 'Agencies provisioned outside the signup flow have no Stripe linkage.' },
      { status: 400 },
    )
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  const origin =
    req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const returnUrl =
    body.returnUrl ?? `${origin}/dashboard/agency/settings?id=${encodeURIComponent(params.id)}`

  try {
    const session = await createBillingPortalSession({
      customerId: agency.stripe_customer_id,
      returnUrl,
    })
    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'portal_failed' }, { status: 500 })
  }
}
