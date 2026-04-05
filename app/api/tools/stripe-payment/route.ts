import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_API_BASE = 'https://api.stripe.com/v1'

export async function POST(request: NextRequest) {
  try {
    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { offerId, businessId, customerEmail, customerName, successUrl, cancelUrl } = body

    if (!offerId) {
      return NextResponse.json(
        { error: 'offerId is required' },
        { status: 400 }
      )
    }

    // Fetch the offer to get pricing details
    const { data: offer, error: offerError } = await supabaseAdmin
      .from('localreach_offers')
      .select('*')
      .eq('id', offerId)
      .single()

    if (offerError) {
      if (offerError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Offer not found' },
          { status: 404 }
        )
      }
      throw offerError
    }

    // Build Stripe Checkout Session params
    const params = new URLSearchParams()
    params.append('mode', offer.offer_type === 'subscription' ? 'subscription' : 'payment')
    params.append('success_url', successUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}`)
    params.append('cancel_url', cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/cancel`)

    if (customerEmail) {
      params.append('customer_email', customerEmail)
    }

    // Use existing Stripe price ID if available, otherwise create a line item
    if (offer.stripe_price_id) {
      params.append('line_items[0][price]', offer.stripe_price_id)
      params.append('line_items[0][quantity]', '1')
    } else {
      // Create an ad-hoc price from the offer pricing
      const priceInCents = Math.round(
        (typeof offer.pricing === 'object' ? offer.pricing.amount : parseFloat(offer.pricing)) * 100
      )

      params.append('line_items[0][price_data][currency]', 'usd')
      params.append('line_items[0][price_data][product_data][name]', offer.name)
      params.append('line_items[0][price_data][product_data][description]', offer.headline || '')
      params.append('line_items[0][price_data][unit_amount]', String(priceInCents))

      if (offer.offer_type === 'subscription') {
        params.append('line_items[0][price_data][recurring][interval]', 'month')
      }

      params.append('line_items[0][quantity]', '1')
    }

    // Add metadata
    params.append('metadata[offer_id]', offerId)
    if (businessId) params.append('metadata[business_id]', businessId)
    if (customerName) params.append('metadata[customer_name]', customerName)

    // Create Checkout Session via Stripe API
    const stripeRes = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!stripeRes.ok) {
      const errData = await stripeRes.json().catch(() => ({}))
      throw new Error(
        `Stripe API error: ${stripeRes.status} ${errData.error?.message || stripeRes.statusText}`
      )
    }

    const session = await stripeRes.json()

    // Log the payment link
    await supabaseAdmin.from('localreach_payment_links').insert({
      offer_id: offerId,
      business_id: businessId || null,
      stripe_session_id: session.id,
      checkout_url: session.url,
      amount_cents: session.amount_total,
      currency: session.currency || 'usd',
      status: 'pending',
      customer_email: customerEmail || null,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      paymentLink: session.url,
      sessionId: session.id,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : null,
    })
  } catch (error: any) {
    console.error('[Stripe Payment API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment link' },
      { status: 500 }
    )
  }
}
