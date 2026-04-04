// F0327: Booking payment link - Include payment link in booking confirmation

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * F0327: Generate payment link for booking
 * POST /api/bookings/:id/payment-link
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      amount,
      currency = 'USD',
      description,
      provider = 'stripe', // 'stripe', 'square', 'paypal'
    } = body;

    // Fetch booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        contact:voice_agent_contacts(
          id,
          full_name,
          email,
          phone_number
        )
      `)
      .eq('id', params.id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    const paymentAmount = amount || booking.price || 0;

    if (paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Generate payment link based on provider
    let paymentLink = '';
    let paymentId = '';

    if (provider === 'stripe') {
      paymentLink = await generateStripePaymentLink(booking, paymentAmount, currency, description);
      paymentId = `stripe_${Date.now()}`;
    } else if (provider === 'square') {
      paymentLink = await generateSquarePaymentLink(booking, paymentAmount, currency, description);
      paymentId = `square_${Date.now()}`;
    } else if (provider === 'paypal') {
      paymentLink = await generatePayPalPaymentLink(booking, paymentAmount, currency, description);
      paymentId = `paypal_${Date.now()}`;
    } else {
      return NextResponse.json(
        { error: 'Invalid payment provider' },
        { status: 400 }
      );
    }

    // Store payment link info
    await supabaseAdmin.from('booking_payments').insert({
      booking_id: booking.id,
      contact_id: booking.contact_id,
      payment_provider: provider,
      amount: paymentAmount,
      currency,
      payment_link: paymentLink,
      payment_id: paymentId,
      status: 'pending',
      description: description || `Payment for ${booking.title}`,
    });

    // Update booking with payment link
    await supabaseAdmin
      .from('bookings')
      .update({
        payment_link: paymentLink,
        payment_required: true,
        payment_status: 'pending',
      })
      .eq('id', booking.id);

    return NextResponse.json({
      success: true,
      booking_id: booking.id,
      payment_link: paymentLink,
      payment_id: paymentId,
      amount: paymentAmount,
      currency,
      provider,
      message: 'Payment link generated successfully',
    });
  } catch (error: any) {
    console.error('Error generating payment link:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate payment link' },
      { status: 500 }
    );
  }
}

/**
 * F0327: Get payment link status
 * GET /api/bookings/:id/payment-link
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Fetch booking payment info
    const { data: payments, error } = await supabaseAdmin
      .from('booking_payments')
      .select('*')
      .eq('booking_id', params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const latestPayment = payments?.[0];

    return NextResponse.json({
      success: true,
      booking_id: params.id,
      payment: latestPayment || null,
      has_payment: !!latestPayment,
      all_payments: payments || [],
    });
  } catch (error: any) {
    console.error('Error fetching payment link:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payment link' },
      { status: 500 }
    );
  }
}

/**
 * Generate Stripe payment link
 */
async function generateStripePaymentLink(
  booking: any,
  amount: number,
  currency: string,
  description?: string
): Promise<string> {
  // In production, use Stripe API to create payment link
  // For now, return placeholder
  const stripeKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!stripeKey) {
    console.warn('STRIPE_PUBLISHABLE_KEY not configured');
    return `https://checkout.stripe.com/pay/placeholder?amount=${amount}&currency=${currency}`;
  }

  // TODO: Implement actual Stripe Payment Link creation
  // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  // const paymentLink = await stripe.paymentLinks.create({...});

  return `https://checkout.stripe.com/pay/${booking.id}?amount=${amount * 100}`;
}

/**
 * Generate Square payment link
 */
async function generateSquarePaymentLink(
  booking: any,
  amount: number,
  currency: string,
  description?: string
): Promise<string> {
  // TODO: Implement Square payment link generation
  return `https://squareup.com/checkout/${booking.id}?amount=${amount}`;
}

/**
 * Generate PayPal payment link
 */
async function generatePayPalPaymentLink(
  booking: any,
  amount: number,
  currency: string,
  description?: string
): Promise<string> {
  // TODO: Implement PayPal payment link generation
  return `https://www.paypal.com/checkoutnow?amount=${amount}&currency=${currency}`;
}
