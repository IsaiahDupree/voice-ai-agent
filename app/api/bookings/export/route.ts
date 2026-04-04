// F0330: Booking export - Export bookings to CSV

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const status = searchParams.get('status')
    const campaignId = searchParams.get('campaign_id')

    // Build query
    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        contacts:voice_agent_contacts(full_name, phone_number, email, company),
        calls:voice_agent_calls!inner(
          campaign_id,
          campaigns:voice_agent_campaigns(name)
        )
      `)
      .order('start_time', { ascending: false })

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (campaignId) {
      query = query.eq('calls.campaign_id', campaignId)
    }

    const { data: bookings, error } = await query

    if (error) throw error

    // Generate CSV
    const csv = generateBookingsCSV(bookings || [])

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="bookings_export_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting bookings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export bookings' },
      { status: 500 }
    )
  }
}

/**
 * Generate CSV from bookings data
 */
function generateBookingsCSV(bookings: any[]): string {
  // CSV headers
  const headers = [
    'Booking ID',
    'Contact Name',
    'Phone',
    'Email',
    'Company',
    'Campaign',
    'Title',
    'Start Time',
    'End Time',
    'Status',
    'Cal.com Booking ID',
    'Created At',
  ]

  // CSV rows
  const rows = bookings.map(booking => [
    booking.id,
    booking.contacts?.full_name || '',
    booking.contacts?.phone_number || '',
    booking.contacts?.email || '',
    booking.contacts?.company || '',
    booking.calls?.campaigns?.name || '',
    booking.title || '',
    booking.start_time || '',
    booking.end_time || '',
    booking.status || '',
    booking.calcom_booking_id || '',
    booking.created_at || '',
  ])

  // Escape CSV values
  const escapeCSV = (value: any): string => {
    const str = String(value || '')
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  // Build CSV
  const csvLines = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ]

  return csvLines.join('\n')
}
