// voiceai:payment-001 — Stripe payment link generation for in-call agent use

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'

let _stripe: Stripe | null = null
const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) {
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' })
    }
    return (_stripe as any)[prop]
  },
})

/**
 * POST /api/payments/link
 * Body: { amount: number (cents), description: string, call_id?: string, currency?: string }
 * Returns: { url: string, payment_link_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, description, call_id, currency = 'usd' } = body

    if (!amount || typeof amount !== 'number' || amount < 50) {
      return NextResponse.json(
        { error: 'amount is required and must be at least 50 cents' },
        { status: 400 }
      )
    }
    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }

    // Create a Stripe Price on-the-fly for this one-time payment
    const price = await stripe.prices.create({
      currency,
      unit_amount: amount,
      product_data: { name: description },
    })

    // Create a Stripe Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      after_completion: { type: 'hosted_confirmation', hosted_confirmation: { custom_message: 'Thank you for your payment.' } },
    })

    // Store payment link on call record if call_id provided
    if (call_id) {
      const { error: updateError } = await supabaseAdmin
        .from('voice_agent_calls')
        .update({ payment_link_url: paymentLink.url, payment_link_id: paymentLink.id })
        .eq('id', call_id)
      if (updateError) {
        console.warn('Failed to store payment link on call record:', updateError.message)
      }
    }

    return NextResponse.json({
      url: paymentLink.url,
      payment_link_id: paymentLink.id,
    })
  } catch (error: any) {
    console.error('Error creating payment link:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
