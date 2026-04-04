/**
 * Feature 134: Assign phone number to tenant
 * POST /api/tenants/:id/phone-numbers
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizePhoneNumber } from '@/lib/phone-utils'

/**
 * Add phone number to tenant
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { phone_number } = body

    if (!phone_number) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Normalize phone number
    const normalized = normalizePhoneNumber(phone_number)

    // Get current tenant
    const { data: tenant, error: fetchError } = await supabaseAdmin
      .from('tenants')
      .select('phone_numbers')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      )
    }

    // Check if phone number is already assigned to this tenant
    const currentNumbers = tenant.phone_numbers || []
    if (currentNumbers.includes(normalized)) {
      return NextResponse.json(
        { error: 'Phone number already assigned to this tenant' },
        { status: 409 }
      )
    }

    // Check if phone number is assigned to another tenant
    const { data: existingTenant } = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .contains('phone_numbers', [normalized])
      .neq('id', id)
      .single()

    if (existingTenant) {
      return NextResponse.json(
        {
          error: `Phone number already assigned to tenant: ${existingTenant.name}`,
        },
        { status: 409 }
      )
    }

    // Add phone number to tenant
    const updatedNumbers = [...currentNumbers, normalized]

    const { data: updatedTenant, error: updateError } = await supabaseAdmin
      .from('tenants')
      .update({
        phone_numbers: updatedNumbers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating tenant phone numbers:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      tenant: updatedTenant,
      message: 'Phone number assigned successfully',
    })
  } catch (error: any) {
    console.error('Error in POST /api/tenants/:id/phone-numbers:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Remove phone number from tenant
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const phone_number = searchParams.get('phone_number')

    if (!phone_number) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Normalize phone number
    const normalized = normalizePhoneNumber(phone_number)

    // Get current tenant
    const { data: tenant, error: fetchError } = await supabaseAdmin
      .from('tenants')
      .select('phone_numbers')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      )
    }

    // Remove phone number
    const currentNumbers = tenant.phone_numbers || []
    const updatedNumbers = currentNumbers.filter((num) => num !== normalized)

    if (currentNumbers.length === updatedNumbers.length) {
      return NextResponse.json(
        { error: 'Phone number not found on this tenant' },
        { status: 404 }
      )
    }

    const { data: updatedTenant, error: updateError } = await supabaseAdmin
      .from('tenants')
      .update({
        phone_numbers: updatedNumbers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating tenant phone numbers:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      tenant: updatedTenant,
      message: 'Phone number removed successfully',
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/tenants/:id/phone-numbers:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
