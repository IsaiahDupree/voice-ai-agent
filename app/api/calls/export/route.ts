// F0171: Inbound call export - Export inbound call log to CSV
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const direction = searchParams.get('direction') || 'inbound'
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const assistantId = searchParams.get('assistant_id')

    // Build query
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('*')
      .eq('direction', direction)
      .order('started_at', { ascending: false })

    if (startDate) {
      query = query.gte('started_at', startDate)
    }
    if (endDate) {
      query = query.lte('started_at', endDate)
    }
    if (assistantId) {
      query = query.eq('assistant_id', assistantId)
    }

    const { data: calls, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Generate CSV
    const headers = [
      'Call ID',
      'Direction',
      'From Number',
      'To Number',
      'Started At',
      'Ended At',
      'Duration (s)',
      'Status',
      'End Reason',
      'Contact Name',
      'Is Voicemail',
      'Is Missed',
      'Cost',
      'Assistant ID',
    ]

    const rows = calls.map(call => [
      call.call_id,
      call.direction,
      call.from_number || '',
      call.to_number || '',
      call.started_at || '',
      call.ended_at || '',
      call.duration_seconds || 0,
      call.status,
      call.end_reason || '',
      call.contact_name || '',
      call.is_voicemail ? 'Yes' : 'No',
      call.is_missed ? 'Yes' : 'No',
      call.cost || 0,
      call.assistant_id || '',
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="calls-${direction}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: error.message || 'Export failed' },
      { status: 500 }
    )
  }
}
