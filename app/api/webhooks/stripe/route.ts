/**
 * Stripe webhook — Sprint 4.2 (PRD §6.4).
 *
 * Handles four lifecycle events that drive agency entitlement:
 *   checkout.session.completed     — first provision after signup
 *   customer.subscription.updated  — plan / status change
 *   customer.subscription.deleted  — cancellation → suspend agency
 *   invoice.payment_failed         — log + mark suspended on dunning
 *
 * Every other event is ignored (200 OK).
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripeClient, syncEntitlement, planFromPriceId, type Plan } from '@/lib/billing'

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) {
    return NextResponse.json({ error: 'webhook not configured' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const raw = await req.text()
    event = stripeClient().webhooks.constructEvent(raw, sig, secret)
  } catch (err: any) {
    return NextResponse.json(
      { error: `signature verification failed: ${err?.message ?? err}` },
      { status: 400 },
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.kind !== 'agency_signup') {
          // Not our signup flow — payment-link checkouts use the same
          // webhook in some setups; ignore them.
          return NextResponse.json({ received: true, ignored: 'not_agency_signup' })
        }
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id
        if (!customerId) {
          return NextResponse.json({ error: 'no customer on session' }, { status: 400 })
        }
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id
        const plan = (session.metadata?.plan as Plan | undefined) ?? null
        const agencyName = session.metadata?.agency_name ?? null
        const agencySlug = session.metadata?.agency_slug ?? null
        const email = session.customer_email ?? session.customer_details?.email ?? null

        // Pull subscription status if available.
        let stripeSubStatus: string | null = null
        if (subscriptionId) {
          const sub = await stripeClient().subscriptions.retrieve(subscriptionId)
          stripeSubStatus = sub.status
        }

        const result = await syncEntitlement({
          customerId,
          subscriptionId: subscriptionId ?? null,
          plan,
          agencySlug,
          agencyName,
          contactEmail: email,
          stripeSubStatus,
        })
        return NextResponse.json({ received: true, agencyId: result.agencyId, created: result.created })
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        const priceId = sub.items.data[0]?.price.id
        const plan = planFromPriceId(priceId) ?? (sub.metadata?.plan as Plan | undefined) ?? null
        const result = await syncEntitlement({
          customerId,
          subscriptionId: sub.id,
          plan,
          stripeSubStatus: sub.status,
        })
        return NextResponse.json({ received: true, agencyId: result.agencyId, plan: result.plan })
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        const result = await syncEntitlement({
          customerId,
          subscriptionId: null,
          plan: null,
          stripeSubStatus: 'canceled',
        })
        return NextResponse.json({ received: true, agencyId: result.agencyId, status: result.status })
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (!customerId) return NextResponse.json({ received: true, ignored: 'no_customer' })
        const subscriptionId =
          typeof (invoice as any).subscription === 'string'
            ? ((invoice as any).subscription as string)
            : (invoice as any).subscription?.id
        await syncEntitlement({
          customerId,
          subscriptionId: subscriptionId ?? null,
          plan: null, // carry forward the existing plan
          stripeSubStatus: 'past_due',
        })
        return NextResponse.json({ received: true, dunning: true })
      }

      default:
        return NextResponse.json({ received: true, ignored: event.type })
    }
  } catch (err: any) {
    console.error(`[stripe-webhook] ${event.type} failed:`, err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? 'webhook handler failed' }, { status: 500 })
  }
}
