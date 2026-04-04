import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0194: DNC list import - Upload DNC list via CSV

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phones, source = 'import', reason } = body

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json(
        { error: 'phones array is required' },
        { status: 400 }
      )
    }

    const entries = phones.map((phone) => ({
      phone: typeof phone === 'string' ? phone : phone.phone,
      source,
      reason: typeof phone === 'object' && phone.reason ? phone.reason : reason,
      added_at: new Date().toISOString(),
    }))

    // Batch insert with on_conflict handling
    const { data, error } = await supabaseAdmin
      .from('voice_agent_dnc')
      .upsert(entries, {
        onConflict: 'phone',
        ignoreDuplicates: true,
      })
      .select()

    if (error) throw error

    const inserted = data?.length || 0
    const skipped = phones.length - inserted

    return NextResponse.json(
      {
        success: true,
        message: `DNC import complete`,
        inserted,
        skipped,
        total: phones.length,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error importing DNC list:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import DNC list' },
      { status: 500 }
    )
  }
}
