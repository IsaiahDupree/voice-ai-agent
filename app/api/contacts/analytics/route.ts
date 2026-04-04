// F0624: CRM contact analytics API

import { NextResponse } from 'next/server'
import { getContactAnalytics } from '@/lib/contact-management'

/**
 * GET /api/contacts/analytics
 * F0624: Returns contact analytics (total, active, new, by stage, etc.)
 */
export async function GET() {
  try {
    const analytics = await getContactAnalytics()

    return NextResponse.json(analytics)
  } catch (error: any) {
    console.error('[Contact Analytics API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
