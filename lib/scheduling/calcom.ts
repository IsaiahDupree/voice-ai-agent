/**
 * Feature 194: Cal.com Scheduling Provider
 * Implementation of SchedulingProvider for Cal.com API
 * Docs: https://cal.com/docs/api-reference
 */

import type {
  SchedulingProvider,
  TimeSlot,
  Booking,
  AvailabilityRequest,
  AvailabilityResult,
  BookAppointmentRequest,
  BookAppointmentResult,
  CancelAppointmentRequest,
  CancelAppointmentResult,
  ListBookingsRequest,
  ListBookingsResult,
} from './types'

interface CalComConfig {
  apiKey: string
  apiUrl: string // e.g., "https://api.cal.com/v1"
  eventTypeId?: string // Default event type ID
}

export class CalComProvider implements SchedulingProvider {
  readonly name = 'calcom'
  private config: CalComConfig

  constructor(config: CalComConfig) {
    this.config = config
  }

  /**
   * Check availability using Cal.com availability endpoint
   */
  async checkAvailability(params: AvailabilityRequest): Promise<AvailabilityResult> {
    const eventTypeId = params.event_type_id || this.config.eventTypeId

    if (!eventTypeId) {
      throw new Error('event_type_id is required for Cal.com availability check')
    }

    try {
      const response = await fetch(
        `${this.config.apiUrl}/availability?` +
          new URLSearchParams({
            eventTypeId: eventTypeId,
            startTime: new Date(params.start_date).toISOString(),
            endTime: new Date(params.end_date).toISOString(),
            timeZone: params.timezone || 'UTC',
          }),
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Cal.com API error: ${response.status} ${error}`)
      }

      const data = await response.json()

      // Transform Cal.com slots to our format
      const slots: TimeSlot[] = (data.busy || []).map((slot: any) => ({
        start: slot.start,
        end: slot.end,
        available: false,
        timezone: params.timezone || 'UTC',
      }))

      // Add available slots (all time slots not in busy list)
      // This is a simplified version - production should calculate actual available slots
      const availableSlots: TimeSlot[] = (data.slots || []).map((slot: any) => ({
        start: slot.time,
        end: new Date(
          new Date(slot.time).getTime() + (params.duration_minutes || 30) * 60000
        ).toISOString(),
        available: true,
        timezone: params.timezone || 'UTC',
      }))

      return {
        slots: [...availableSlots, ...slots],
        timezone: params.timezone || 'UTC',
        duration_minutes: params.duration_minutes || 30,
      }
    } catch (error: any) {
      console.error('Cal.com availability check failed:', error)
      throw error
    }
  }

  /**
   * Book an appointment via Cal.com bookings endpoint
   */
  async bookAppointment(params: BookAppointmentRequest): Promise<BookAppointmentResult> {
    const eventTypeId = params.event_type_id || this.config.eventTypeId

    if (!eventTypeId) {
      throw new Error('event_type_id is required for Cal.com booking')
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/bookings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventTypeId: parseInt(eventTypeId),
          start: params.start_time,
          end: params.end_time,
          responses: {
            name: params.customer_name,
            email: params.customer_email || '',
            notes: params.notes || '',
          },
          timeZone: params.timezone,
          language: 'en',
          metadata: {
            phone: params.customer_phone,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        return {
          success: false,
          error: `Cal.com booking failed: ${response.status} ${error}`,
        }
      }

      const data = await response.json()

      const booking: Booking = {
        id: String(data.id),
        provider: 'calcom',
        customer_name: params.customer_name,
        customer_email: params.customer_email,
        customer_phone: params.customer_phone,
        start_time: data.startTime,
        end_time: data.endTime,
        timezone: params.timezone,
        status: data.status === 'ACCEPTED' ? 'confirmed' : 'pending',
        notes: params.notes,
        meeting_url: data.metadata?.videoCallUrl,
        location: data.location,
        created_at: data.createdAt,
        updated_at: data.updatedAt || data.createdAt,
      }

      return {
        success: true,
        booking,
      }
    } catch (error: any) {
      console.error('Cal.com booking failed:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Cancel a booking via Cal.com API
   */
  async cancelAppointment(params: CancelAppointmentRequest): Promise<CancelAppointmentResult> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/bookings/${params.booking_id}/cancel`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cancellationReason: params.reason || 'Cancelled by user',
          }),
        }
      )

      if (!response.ok) {
        const error = await response.text()
        return {
          success: false,
          error: `Cal.com cancellation failed: ${response.status} ${error}`,
        }
      }

      return {
        success: true,
      }
    } catch (error: any) {
      console.error('Cal.com cancellation failed:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get a single booking by ID
   */
  async getBooking(bookingId: string): Promise<Booking | null> {
    try {
      const response = await fetch(`${this.config.apiUrl}/bookings/${bookingId}`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()

      return {
        id: String(data.id),
        provider: 'calcom',
        customer_name: data.attendees?.[0]?.name || 'Unknown',
        customer_email: data.attendees?.[0]?.email,
        customer_phone: data.metadata?.phone,
        start_time: data.startTime,
        end_time: data.endTime,
        timezone: data.timeZone,
        status: data.status === 'ACCEPTED' ? 'confirmed' : data.status === 'CANCELLED' ? 'cancelled' : 'pending',
        notes: data.description,
        meeting_url: data.metadata?.videoCallUrl,
        location: data.location,
        created_at: data.createdAt,
        updated_at: data.updatedAt || data.createdAt,
      }
    } catch (error: any) {
      console.error('Cal.com get booking failed:', error)
      return null
    }
  }

  /**
   * List bookings
   */
  async listBookings(params: ListBookingsRequest): Promise<ListBookingsResult> {
    try {
      const queryParams: Record<string, string> = {
        take: String(params.limit || 50),
        skip: String(params.offset || 0),
      }

      if (params.status && params.status !== 'all') {
        queryParams.status = params.status.toUpperCase()
      }

      const response = await fetch(
        `${this.config.apiUrl}/bookings?` + new URLSearchParams(queryParams),
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Cal.com list bookings failed: ${response.status}`)
      }

      const data = await response.json()

      const bookings: Booking[] = (data.bookings || []).map((b: any) => ({
        id: String(b.id),
        provider: 'calcom',
        customer_name: b.attendees?.[0]?.name || 'Unknown',
        customer_email: b.attendees?.[0]?.email,
        customer_phone: b.metadata?.phone,
        start_time: b.startTime,
        end_time: b.endTime,
        timezone: b.timeZone,
        status: b.status === 'ACCEPTED' ? 'confirmed' : b.status === 'CANCELLED' ? 'cancelled' : 'pending',
        notes: b.description,
        meeting_url: b.metadata?.videoCallUrl,
        location: b.location,
        created_at: b.createdAt,
        updated_at: b.updatedAt || b.createdAt,
      }))

      return {
        bookings,
        total: data.total || bookings.length,
        has_more: bookings.length >= (params.limit || 50),
      }
    } catch (error: any) {
      console.error('Cal.com list bookings failed:', error)
      return {
        bookings: [],
        total: 0,
        has_more: false,
      }
    }
  }

  /**
   * Health check - verify Cal.com API connectivity
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.config.apiUrl}/me`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return {
          healthy: false,
          error: `Cal.com API returned ${response.status}`,
        }
      }

      return { healthy: true }
    } catch (error: any) {
      return {
        healthy: false,
        error: error.message,
      }
    }
  }
}
