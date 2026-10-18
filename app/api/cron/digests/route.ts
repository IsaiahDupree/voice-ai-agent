export const dynamic = 'force-dynamic'

/**
 * /api/cron/digests — picks all due digest subscriptions and sends.
 *
 * Auth via x-cron-secret header (or Authorization: Bearer <CRON_SECRET>).
 * Designed to be called every 30–60 minutes; the per-subscription
 * interval check (DAILY_INTERVAL_MS / WEEKLY_INTERVAL_MS in
 * lib/digest-sender) prevents duplicates.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runDigestCron } from '@/lib/digest-sender'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  if (CRON_SECRET) {
    const auth = request.headers.get('authorization')
    const x = request.headers.get('x-cron-secret')
    const token = x || auth?.replace('Bearer ', '')
    if (token !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  const results = await runDigestCron()
  const sent = results.filter(r => r.status === 'sent').length
  const failed = results.filter(r => r.status === 'failed').length
  const skipped = results.filter(r => r.status === 'skipped').length
  return NextResponse.json({
    total: results.length,
    sent,
    failed,
    skipped,
    results,
  })
}
