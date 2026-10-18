/**
 * Agency billing — Sprint 4 (PRD §6.4).
 *
 * Maps Stripe subscriptions to agency entitlements. The flow:
 *   1. Agency owner signs up via /signup → POST /api/agencies/signup
 *      builds a Checkout Session with metadata (slug, name, contact_email).
 *   2. Stripe redirects to /signup/success?session_id=...
 *   3. Stripe fires checkout.session.completed → /api/webhooks/stripe
 *      provisions / activates the agency with plan + max_clients +
 *      stripe_customer_id + stripe_subscription_id.
 *   4. Subsequent customer.subscription.updated events keep the
 *      entitlement in sync if the agency upgrades / downgrades.
 *   5. customer.subscription.deleted suspends the agency.
 *
 * Plan → entitlement mapping lives here so the webhook + the signup
 * page agree.
 */

import Stripe from 'stripe'
import { supabaseAdmin } from './supabase'

let _stripe: Stripe | null = null
export function stripeClient(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured')
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' })
  }
  return _stripe
}

export type Plan = 'starter' | 'growth' | 'scale' | 'enterprise'

export interface PlanSpec {
  plan: Plan
  /** Stripe Price ID — env-driven so test/live can differ. */
  priceEnvVar: string
  maxClients: number
  display: string
  monthlyUsd: number
}

export const PLAN_CATALOG: Record<Plan, PlanSpec> = {
  starter: {
    plan: 'starter',
    priceEnvVar: 'STRIPE_PRICE_STARTER',
    maxClients: 5,
    display: 'Starter',
    monthlyUsd: 297,
  },
  growth: {
    plan: 'growth',
    priceEnvVar: 'STRIPE_PRICE_GROWTH',
    maxClients: 25,
    display: 'Growth',
    monthlyUsd: 997,
  },
  scale: {
    plan: 'scale',
    priceEnvVar: 'STRIPE_PRICE_SCALE',
    maxClients: 50,
    display: 'Scale',
    monthlyUsd: 2497,
  },
  enterprise: {
    plan: 'enterprise',
    priceEnvVar: 'STRIPE_PRICE_ENTERPRISE',
    maxClients: 1000,
    display: 'Enterprise',
    monthlyUsd: 0, // contact us
  },
}

export function planFromPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null
  for (const p of Object.values(PLAN_CATALOG)) {
    if (process.env[p.priceEnvVar] === priceId) return p.plan
  }
  return null
}

export function planSpec(plan: Plan): PlanSpec {
  return PLAN_CATALOG[plan]
}

export function maxClientsFor(plan: Plan): number {
  return PLAN_CATALOG[plan].maxClients
}

interface CheckoutInput {
  agencyName: string
  agencySlug: string
  contactEmail: string
  plan: Plan
  successUrl: string
  cancelUrl: string
}

/**
 * Build a Checkout Session for agency signup. Stripe drives the flow;
 * we only get a row in the DB after the webhook fires.
 */
export async function createSignupCheckoutSession(
  input: CheckoutInput,
): Promise<{ url: string; sessionId: string }> {
  const spec = planSpec(input.plan)
  const priceId = process.env[spec.priceEnvVar]
  if (!priceId) {
    throw new Error(`Stripe price not configured for plan ${input.plan} (${spec.priceEnvVar})`)
  }
  if (input.plan === 'enterprise') {
    throw new Error('enterprise plans are not self-serve')
  }

  const session = await stripeClient().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: input.contactEmail,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: {
        agency_name: input.agencyName,
        agency_slug: input.agencySlug,
        plan: input.plan,
      },
    },
    metadata: {
      agency_name: input.agencyName,
      agency_slug: input.agencySlug,
      plan: input.plan,
      kind: 'agency_signup',
    },
  })

  if (!session.url) throw new Error('Stripe did not return a checkout URL')
  return { url: session.url, sessionId: session.id }
}

/**
 * Self-serve billing portal — agency manages plan / payment method /
 * cancellation themselves. Stripe handles all the UI.
 */
export async function createBillingPortalSession(input: {
  customerId: string
  returnUrl: string
}): Promise<{ url: string }> {
  const session = await stripeClient().billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
  })
  return { url: session.url }
}

// ─── Entitlement sync (called by the Stripe webhook) ─────────────────

interface EntitlementInput {
  customerId: string
  subscriptionId?: string | null
  /** Resolved plan, OR null when subscription is gone. */
  plan: Plan | null
  agencySlug?: string | null
  agencyName?: string | null
  contactEmail?: string | null
  /** active | past_due | canceled | unpaid → status mapping. */
  stripeSubStatus?: string | null
}

export interface EntitlementResult {
  agencyId: string
  status: 'active' | 'suspended' | 'archived'
  plan: Plan
  maxClients: number
  created: boolean
}

/**
 * Idempotent entitlement update keyed on Stripe customer ID. Creates the
 * agency on first run (after checkout); updates the entitlement on
 * subscription change; suspends on cancellation.
 */
export async function syncEntitlement(input: EntitlementInput): Promise<EntitlementResult> {
  const status: 'active' | 'suspended' = (() => {
    if (!input.subscriptionId) return 'suspended'
    switch (input.stripeSubStatus) {
      case 'active':
      case 'trialing':
        return 'active'
      case 'past_due':
      case 'unpaid':
      case 'incomplete':
      case 'incomplete_expired':
      case 'canceled':
      case 'paused':
        return 'suspended'
      default:
        return 'active'
    }
  })()

  // Resolve plan: prefer the input, otherwise carry forward the existing
  // row's plan (so a subscription.updated with no price change doesn't
  // reset to starter).
  const { data: existing } = await supabaseAdmin
    .from('agencies')
    .select('id, plan, slug, name')
    .eq('stripe_customer_id', input.customerId)
    .maybeSingle()

  const plan: Plan = (input.plan ?? (existing?.plan as Plan | undefined) ?? 'starter') as Plan
  const maxClients = maxClientsFor(plan)

  if (existing) {
    await supabaseAdmin
      .from('agencies')
      .update({
        plan,
        max_clients: maxClients,
        status,
        stripe_subscription_id: input.subscriptionId ?? null,
        contact_email: input.contactEmail ?? undefined,
      })
      .eq('id', existing.id)
    return {
      agencyId: existing.id as string,
      status,
      plan,
      maxClients,
      created: false,
    }
  }

  // First-run provisioning. Stripe customer exists but no agency row yet.
  const slug =
    input.agencySlug ??
    (input.agencyName
      ? input.agencyName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 40) +
        '-' +
        Math.random().toString(36).slice(2, 6)
      : `agency-${Math.random().toString(36).slice(2, 8)}`)

  const { data: created, error } = await supabaseAdmin
    .from('agencies')
    .insert({
      slug,
      name: input.agencyName ?? slug,
      contact_email: input.contactEmail ?? null,
      plan,
      max_clients: maxClients,
      status,
      stripe_customer_id: input.customerId,
      stripe_subscription_id: input.subscriptionId ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`syncEntitlement insert failed: ${error.message}`)

  return {
    agencyId: (created as any).id,
    status,
    plan,
    maxClients,
    created: true,
  }
}
