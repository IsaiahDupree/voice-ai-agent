import { calcomClient } from '../calcom'
import type {
  CalendarProvider,
  CalendarSlot,
  CalendarBookingInput,
  CalendarBooking,
  ProviderHealth,
} from './types'

export class CalComCalendar implements CalendarProvider {
  readonly slug = 'cal_com'

  async listSlots(opts: { eventTypeId?: string | number; date: string }): Promise<CalendarSlot[]> {
    const eventTypeId = Number(opts.eventTypeId ?? process.env.CALCOM_DEFAULT_EVENT_TYPE_ID ?? 0)
    if (!eventTypeId) return []
    const slots = await calcomClient.getAvailability(eventTypeId, opts.date)
    return slots.map((s: any) => ({
      start: s.time ?? s.start,
      end: s.end ?? s.time,
      available: s.available !== false,
    }))
  }

  async bookSlot(input: CalendarBookingInput): Promise<CalendarBooking> {
    const eventTypeId = Number(input.eventTypeId ?? process.env.CALCOM_DEFAULT_EVENT_TYPE_ID ?? 0)
    const booking = await calcomClient.createBooking({
      eventTypeId,
      start: input.start,
      attendeeName: input.attendeeName,
      attendeeEmail: input.attendeeEmail,
      attendeePhone: input.attendeePhone,
      notes: input.notes,
      metadata: input.metadata,
    } as any)
    return {
      id: String((booking as any).id ?? (booking as any).uid ?? ''),
      start: (booking as any).startTime ?? input.start,
      end: (booking as any).endTime ?? input.end ?? input.start,
      status: 'confirmed',
      raw: booking,
    }
  }

  async cancelBooking(id: string, reason?: string): Promise<void> {
    await calcomClient.cancelBooking(id, reason)
  }

  async rescheduleBooking(id: string, newStart: string): Promise<CalendarBooking> {
    const b = await calcomClient.rescheduleBooking(id, newStart)
    return {
      id: String((b as any).id ?? id),
      start: (b as any).startTime ?? newStart,
      end: (b as any).endTime ?? newStart,
      status: 'confirmed',
      raw: b,
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    return calcomClient.healthCheck()
  }
}
