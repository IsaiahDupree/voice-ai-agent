// F1013: DELETE /api/blocklist/:phone - Removes from blocklist

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * F1013: DELETE /api/blocklist/:phone
 * Removes a phone number from the blocklist (DNC list)
 * Params:
 *   - phone: Phone number to unblock
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { phone: string } }
) {
  try {
    const phone = params.phone

    if (!phone) {
      return NextResponse.json(
        { error: 'phone parameter is required' },
        { status: 400 }
      )
    }

    // Check if exists in blocklist
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('dnc_list')
      .select('id')
      .eq('phone', phone)
      .single()

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError
    }

    if (!existing) {
      return NextResponse.json(
        { error: 'Phone number not found in blocklist' },
        { status: 404 }
      )
    }

    // Remove from blocklist
    const { error: deleteError } = await supabaseAdmin
      .from('dnc_list')
      .delete()
      .eq('phone', phone)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: 'Number removed from blocklist',
      phone,
    })
  } catch (error: any) {
    console.error('Error removing from blocklist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove from blocklist' },
      { status: 500 }
    )
  }
}
