// F0287: Cancel reason - capture and track booking cancellation reasons

import { supabaseAdmin } from '@/lib/supabase'

export type CancellationReason =
  | 'schedule_conflict'
  | 'no_longer_needed'
  | 'wrong_time'
  | 'emergency'
  | 'duplicate_booking'
  | 'customer_request'
  | 'other'

export interface CancellationData {
  booking_id: string
  reason: CancellationReason
  reason_text?: string
  canceled_by: 'customer' | 'agent' | 'system'
  refund_issued?: boolean
}

/**
 * F0287: Cancel booking with reason tracking
 */
export async function cancelBookingWithReason(data: CancellationData): Promise<{
  success: boolean
  booking_id: string
  cancel_record_id: string
}> {
  const supabase = supabaseAdmin

  // Update booking status
  const { error: bookingError } = await supabase
    .from('bookings')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('id', data.booking_id)

  if (bookingError) {
    throw new Error(`Failed to cancel booking: ${bookingError.message}`)
  }

  // Record cancellation with reason
  const { data: cancelRecord, error: cancelError } = await supabase
    .from('booking_cancellations')
    .insert({
      booking_id: data.booking_id,
      reason: data.reason,
      reason_text: data.reason_text,
      canceled_by: data.canceled_by,
      refund_issued: data.refund_issued || false,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (cancelError) {
    throw new Error(`Failed to record cancellation: ${cancelError.message}`)
  }

  return {
    success: true,
    booking_id: data.booking_id,
    cancel_record_id: cancelRecord.id,
  }
}

/**
 * F0287: Get cancellation statistics
 */
export async function getCancellationStats(startDate?: string, endDate?: string): Promise<{
  total_cancellations: number
  by_reason: Record<CancellationReason, number>
  by_actor: Record<'customer' | 'agent' | 'system', number>
  refund_rate: number
}> {
  const supabase = supabaseAdmin

  let query = supabase.from('booking_cancellations').select('*')

  if (startDate) {
    query = query.gte('created_at', startDate)
  }
  if (endDate) {
    query = query.lte('created_at', endDate)
  }

  const { data: cancellations } = await query

  if (!cancellations || cancellations.length === 0) {
    return {
      total_cancellations: 0,
      by_reason: {} as Record<CancellationReason, number>,
      by_actor: { customer: 0, agent: 0, system: 0 },
      refund_rate: 0,
    }
  }

  const byReason: Record<string, number> = {}
  const byActor: Record<string, number> = { customer: 0, agent: 0, system: 0 }
  let refundCount = 0

  cancellations.forEach((c) => {
    byReason[c.reason] = (byReason[c.reason] || 0) + 1
    byActor[c.canceled_by] = (byActor[c.canceled_by] || 0) + 1
    if (c.refund_issued) refundCount++
  })

  return {
    total_cancellations: cancellations.length,
    by_reason: byReason as Record<CancellationReason, number>,
    by_actor: byActor as Record<'customer' | 'agent' | 'system', number>,
    refund_rate: (refundCount / cancellations.length) * 100,
  }
}
