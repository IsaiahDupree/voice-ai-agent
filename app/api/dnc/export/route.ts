import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0196: DNC export - Download DNC list as CSV

export async function GET(request: NextRequest) {
  try {
    // Get all DNC entries
    const { data, error } = await supabaseAdmin
      .from('voice_agent_dnc')
      .select('*')
      .order('added_at', { ascending: false })

    if (error) throw error

    if (!data || data.length === 0) {
      return new NextResponse('phone,source,reason,added_by,added_at\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="dnc-list.csv"',
        },
      })
    }

    // Generate CSV
    const csvRows = [
      // Header row
      'phone,source,reason,added_by,added_at',
      // Data rows
      ...data.map(entry => {
        const phone = entry.phone || ''
        const source = entry.source || ''
        const reason = (entry.reason || '').replace(/"/g, '""') // Escape quotes
        const addedBy = entry.added_by || ''
        const addedAt = entry.added_at || ''

        return `"${phone}","${source}","${reason}","${addedBy}","${addedAt}"`
      }),
    ]

    const csvContent = csvRows.join('\n')

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="dnc-list-${new Date().toISOString().split('T')[0]}.csv"`,
        'Content-Length': String(Buffer.byteLength(csvContent)),
      },
    })
  } catch (error: any) {
    console.error('Error exporting DNC list:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export DNC list' },
      { status: 500 }
    )
  }
}
