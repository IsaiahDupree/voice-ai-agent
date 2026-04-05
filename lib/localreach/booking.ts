/**
 * LocalReach V3 — Booking + Payment Routing
 * Calendly integration, Stripe payment links, post-call SMS, conversion tracking.
 */
import axios from 'axios'
import Stripe from 'stripe'
import { supabaseAdmin } from '../supabase'
import { sendSMS, formatE164 } from '../sms'
import type { Conversion, CalendlySlot } from './types'

const CALENDLY_API_TOKEN = process.env.CALENDLY_API_TOKEN!
const CALENDLY_EVENT_TYPE_URL = process.env.CALENDLY_EVENT_TYPE_URL!
const CALENDLY_BASE_URL = 'https://api.calendly.com'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!

const calendlyClient = axios.create({
  baseURL: CALENDLY_BASE_URL,
  headers: {
    Authorization: `Bearer ${CALENDLY_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
})

function getStripeClient(): Stripe {
  return new Stripe(STRIPE_SECRET_KEY)
}

/**
 * Fetch the next 3 available Calendly slots.
 */
export async function checkCalendlySlots(): Promise<CalendlySlot[]> {
  const now = new Date()
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 14) // Look ahead 2 weeks

  const response = await calendlyClient.get('/event_type_available_times', {
    params: {
      event_type: CALENDLY_EVENT_TYPE_URL,
      start_time: now.toISOString(),
      end_time: maxDate.toISOString(),
    },
  })

  const availableTimes = response.data?.collection || []

  return availableTimes
    .filter((slot: { status: string }) => slot.status === 'available')
    .slice(0, 3)
    .map((slot: { start_time: string; end_time?: string; status: string }) => ({
      start_time: slot.start_time,
      end_time: slot.end_time || new Date(new Date(slot.start_time).getTime() + 15 * 60 * 1000).toISOString(),
      status: 'available' as const,
    }))
}

/**
 * Book a specific Calendly slot for a business.
 */
export async function bookCalendlySlot(
  datetime: string,
  businessName: string,
  phone: string
): Promise<{ success: boolean; event_url: string | null; error?: string }> {
  try {
    // Calendly uses "scheduled events" via invitees — create via one-off scheduling link
    // First, get the event type UUID from the URL
    const eventTypeResponse = await calendlyClient.get('/event_types', {
      params: {
        // The event type URL contains the user and event type info
        count: 100,
      },
    })

    const eventTypes = eventTypeResponse.data?.collection || []
    const targetEventType = eventTypes.find(
      (et: { scheduling_url: string }) => et.scheduling_url === CALENDLY_EVENT_TYPE_URL
    ) || eventTypes[0]

    if (!targetEventType) {
      return { success: false, event_url: null, error: 'No event type found in Calendly' }
    }

    // Create a single-use scheduling link for this business
    const linkResponse = await calendlyClient.post('/scheduling_links', {
      max_event_count: 1,
      owner: targetEventType.uri,
      owner_type: 'EventType',
    })

    const bookingUrl = linkResponse.data?.resource?.booking_url

    if (!bookingUrl) {
      return { success: false, event_url: null, error: 'Failed to create scheduling link' }
    }

    // Send the booking link via SMS for the prospect to confirm
    const phoneE164 = formatE164(phone)
    const smsBody = `Hi ${businessName}! Here's your link to book a 15-min demo at ${formatReadableTime(datetime)}: ${bookingUrl}`

    await sendSMS({ to: phoneE164, body: smsBody })

    return { success: true, event_url: bookingUrl }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Failed to book Calendly slot:', errorMessage)
    return { success: false, event_url: null, error: errorMessage }
  }
}

/**
 * Create a Stripe Checkout payment link for an offer.
 */
export async function createStripePaymentLink(
  offerId: string,
  businessName: string
): Promise<{ success: boolean; url: string | null; error?: string }> {
  try {
    // Fetch the offer to get the Stripe price ID
    const { data: offer, error: offerError } = await supabaseAdmin
      .from('localreach_offers')
      .select('*')
      .eq('id', offerId)
      .single()

    if (offerError || !offer) {
      return { success: false, url: null, error: `Offer ${offerId} not found` }
    }

    const stripe = getStripeClient()

    // Check if the price ID is a placeholder — if so, create a price dynamically
    let priceId = offer.stripe_price_id as string

    if (priceId.startsWith('price_') && !priceId.startsWith('price_1')) {
      // Placeholder price — create a real one
      const product = await stripe.products.create({
        name: offer.name as string,
        description: offer.description as string,
        metadata: {
          offer_id: offerId,
          localreach: 'true',
        },
      })

      const billingInterval = offer.billing_interval as string
      const priceParams: Record<string, unknown> = {
        product: product.id,
        unit_amount: offer.price_cents as number,
        currency: 'usd',
      }

      if (billingInterval === 'monthly') {
        priceParams.recurring = { interval: 'month' }
      } else if (billingInterval === 'annual') {
        priceParams.recurring = { interval: 'year' }
      }

      const price = await stripe.prices.create(priceParams as unknown as Parameters<typeof stripe.prices.create>[0])
      priceId = price.id

      // Update the offer with the real price ID
      await supabaseAdmin
        .from('localreach_offers')
        .update({ stripe_price_id: priceId, updated_at: new Date().toISOString() })
        .eq('id', offerId)
    }

    // Create checkout session
    const sessionMode = (offer.billing_interval as string) === 'one_time' ? 'payment' : 'subscription'
    const sessionParams: Record<string, unknown> = {
      mode: sessionMode,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'}/booking/cancel`,
      metadata: {
        offer_id: offerId,
        business_name: businessName,
        source: 'localreach_call',
      },
      customer_creation: 'always',
      phone_number_collection: { enabled: true },
    }

    // Apply discount if the offer has one
    const discountPercent = offer.discount_threshold_percent as number
    if (discountPercent > 0) {
      const coupon = await stripe.coupons.create({
        percent_off: discountPercent,
        duration: 'once',
        metadata: { offer_id: offerId, source: 'localreach' },
      } as Parameters<typeof stripe.coupons.create>[0])
      sessionParams.discounts = [{ coupon: coupon.id }]
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
    )

    return { success: true, url: session.url }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Failed to create Stripe payment link:', errorMessage)
    return { success: false, url: null, error: errorMessage }
  }
}

/**
 * Send a post-call SMS via the existing SMS system.
 */
export async function sendPostCallSMS(
  phone: string,
  message: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const phoneE164 = formatE164(phone)
    const result = await sendSMS({ to: phoneE164, body: message })
    return { success: result.success, sid: result.sid }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Failed to send post-call SMS:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Record a conversion event in the localreach_conversions table.
 */
export async function recordConversion(data: {
  campaign_id: string
  business_id: string
  call_attempt_id?: string
  offer_id: string
  conversion_type: 'booking' | 'payment' | 'trial' | 'demo'
  calendly_event_id?: string
  stripe_payment_intent_id?: string
  stripe_checkout_url?: string
  amount_cents: number
  discount_applied_percent?: number
  notes?: string
}): Promise<Conversion> {
  const now = new Date().toISOString()

  const { data: inserted, error } = await supabaseAdmin
    .from('localreach_conversions')
    .insert({
      campaign_id: data.campaign_id,
      business_id: data.business_id,
      call_attempt_id: data.call_attempt_id || null,
      offer_id: data.offer_id,
      conversion_type: data.conversion_type,
      calendly_event_id: data.calendly_event_id || null,
      stripe_payment_intent_id: data.stripe_payment_intent_id || null,
      stripe_checkout_url: data.stripe_checkout_url || null,
      amount_cents: data.amount_cents,
      discount_applied_percent: data.discount_applied_percent || 0,
      status: 'pending',
      follow_up_scheduled: false,
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to record conversion: ${error.message}`)
  }

  // Update campaign revenue
  await supabaseAdmin.rpc('increment_campaign_revenue', {
    p_campaign_id: data.campaign_id,
    p_amount: data.amount_cents,
  }).then(({ error: rpcError }) => {
    // Fallback if RPC doesn't exist
    if (rpcError) {
      return supabaseAdmin
        .from('localreach_campaigns')
        .update({
          total_conversions: (inserted as Conversion).id ? 1 : 0, // increment handled below
          updated_at: now,
        })
        .eq('id', data.campaign_id)
    }
  })

  // Increment campaign conversion count and revenue
  const { data: campaign } = await supabaseAdmin
    .from('localreach_campaigns')
    .select('total_conversions, total_revenue_cents')
    .eq('id', data.campaign_id)
    .single()

  if (campaign) {
    await supabaseAdmin
      .from('localreach_campaigns')
      .update({
        total_conversions: (campaign.total_conversions as number) + 1,
        total_revenue_cents: (campaign.total_revenue_cents as number) + data.amount_cents,
        updated_at: now,
      })
      .eq('id', data.campaign_id)
  }

  // Update business status to converted
  await supabaseAdmin
    .from('localreach_businesses')
    .update({ status: 'converted', updated_at: now })
    .eq('id', data.business_id)

  return inserted as Conversion
}

// ─── Helpers ───

function formatReadableTime(isoDatetime: string): string {
  try {
    const date = new Date(isoDatetime)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  } catch {
    return isoDatetime
  }
}
