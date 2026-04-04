// F0345: Slot confirmation code - Generate 6-digit confirmation code for booking

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Generate a 6-digit confirmation code
 */
function generateConfirmationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * F0345: Generate confirmation code for booking
 * POST /api/bookings/:id/confirmation-code
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { regenerate = false } = body;

    // Fetch booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', params.id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Check if code already exists
    if (booking.confirmation_code && !regenerate) {
      return NextResponse.json({
        success: true,
        booking_id: booking.id,
        confirmation_code: booking.confirmation_code,
        generated_at: booking.confirmation_code_generated_at,
        message: 'Confirmation code already exists',
        note: 'Use regenerate=true to create a new code',
      });
    }

    // Generate new code
    const confirmationCode = generateConfirmationCode();

    // Update booking with confirmation code
    const { data: updatedBooking, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        confirmation_code: confirmationCode,
        confirmation_code_generated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      booking_id: updatedBooking.id,
      confirmation_code: confirmationCode,
      generated_at: updatedBooking.confirmation_code_generated_at,
      message: regenerate ? 'New confirmation code generated' : 'Confirmation code generated',
    });
  } catch (error: any) {
    console.error('Error generating confirmation code:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate confirmation code',
    }, { status: 500 });
  }
}

/**
 * F0345: Verify confirmation code
 * GET /api/bookings/:id/confirmation-code?code=123456
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Confirmation code query parameter is required' },
        { status: 400 }
      );
    }

    // Fetch booking
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('id, confirmation_code, status, start_time, end_time')
      .eq('id', params.id)
      .single();

    if (error || !booking) {
      return NextResponse.json({
        success: false,
        verified: false,
        error: 'Booking not found',
      }, { status: 404 });
    }

    // Verify code
    const isValid = booking.confirmation_code === code;

    if (!isValid) {
      return NextResponse.json({
        success: false,
        verified: false,
        message: 'Invalid confirmation code',
      }, { status: 400 });
    }

    // Check if booking is still active
    const now = new Date();
    const startTime = new Date(booking.start_time);
    const isPast = startTime < now;
    const isCanceled = booking.status === 'canceled';

    return NextResponse.json({
      success: true,
      verified: true,
      booking_id: booking.id,
      booking_status: booking.status,
      is_past: isPast,
      is_canceled: isCanceled,
      start_time: booking.start_time,
      end_time: booking.end_time,
      message: isValid ? 'Confirmation code verified' : 'Invalid code',
    });
  } catch (error: any) {
    console.error('Error verifying confirmation code:', error);
    return NextResponse.json({
      success: false,
      verified: false,
      error: error.message || 'Failed to verify code',
    }, { status: 500 });
  }
}
