import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Helper function to generate 6-digit confirmation code
function generateConfirmationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// F0345: POST /api/cal/confirmation-code - Generate confirmation code for booking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      bookingId,
      eventTypeId,
      contactEmail,
    } = body

    if (!bookingId && !eventTypeId) {
      return NextResponse.json(
        { error: 'bookingId or eventTypeId is required' },
        { status: 400 }
      )
    }

    // Generate 6-digit confirmation code
    const confirmationCode = generateConfirmationCode()

    // Store confirmation code
    const { data: code, error: codeError } = await supabaseAdmin
      .from('calcom_confirmation_codes')
      .insert({
        booking_id: bookingId || null,
        event_type_id: eventTypeId || null,
        confirmation_code: confirmationCode,
        contact_email: contactEmail || null,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      })
      .select()
      .single()

    if (codeError) {
      throw codeError
    }

    return NextResponse.json({
      success: true,
      confirmation_code: confirmationCode,
      booking_id: bookingId,
      expires_in_hours: 24,
      created_at: code.generated_at,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error generating confirmation code:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate confirmation code' },
      { status: 500 }
    )
  }
}

// F0345: GET /api/cal/confirmation-code - Verify confirmation code
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const confirmationCode = searchParams.get('code')
    const bookingId = searchParams.get('bookingId')

    if (!confirmationCode) {
      return NextResponse.json(
        { error: 'confirmation code is required' },
        { status: 400 }
      )
    }

    // Look up confirmation code
    let query = supabaseAdmin
      .from('calcom_confirmation_codes')
      .select('*')
      .eq('confirmation_code', confirmationCode)

    if (bookingId) {
      query = query.eq('booking_id', bookingId)
    }

    const { data: code, error: codeError } = await query.single()

    if (codeError || !code) {
      return NextResponse.json(
        { error: 'Confirmation code not found or invalid' },
        { status: 404 }
      )
    }

    // Check if code is expired
    const expiresAt = new Date(code.expires_at)
    const isExpired = expiresAt < new Date()

    if (isExpired) {
      return NextResponse.json(
        { error: 'Confirmation code has expired' },
        { status: 410 }
      )
    }

    return NextResponse.json({
      success: true,
      valid: true,
      confirmation_code: code.confirmation_code,
      booking_id: code.booking_id,
      expires_at: code.expires_at,
    })
  } catch (error: any) {
    console.error('Error verifying confirmation code:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to verify confirmation code' },
      { status: 500 }
    )
  }
}
