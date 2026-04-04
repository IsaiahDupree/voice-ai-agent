// F0540: SMS opt-out export API endpoint
import { NextRequest, NextResponse } from 'next/server'
import { exportOptOutList } from '@/lib/sms-helpers'

export async function GET(request: NextRequest) {
  try {
    const csv = await exportOptOutList()

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="sms-opt-outs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error('Export opt-out list error:', error)
    return NextResponse.json(
      { error: error.message || 'Export failed' },
      { status: 500 }
    )
  }
}
