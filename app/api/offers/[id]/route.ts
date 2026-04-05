import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { data, error } = await supabaseAdmin
      .from('localreach_offers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Offer not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, offer: data })
  } catch (error: any) {
    console.error('[Offer GET API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get offer' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('localreach_offers')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Offer not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, offer: data })
  } catch (error: any) {
    console.error('[Offer PATCH API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update offer' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { error } = await supabaseAdmin
      .from('localreach_offers')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Offer DELETE API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete offer' },
      { status: 500 }
    )
  }
}
