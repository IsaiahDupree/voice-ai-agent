/**
 * Feature 196: Google Calendar Scheduling Provider
 * Direct Google Calendar API implementation (no third-party SDK)
 * Docs: https://developers.google.com/calendar/api/v3/reference
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

interface GoogleCalendarConfig {
  credentials: {
    client_id?: string
    client_secret?: string
    refresh_token?: string
  }
  calendarId: string // Default: 'primary'
}

export class GoogleCalendarProvider implements SchedulingProvider {
  readonly name = 'google-calendar'
  private config: GoogleCalendarConfig
  private accessToken: string | null = null
  private tokenExpiry: number | null = null

  constructor(config: GoogleCalendarConfig) {
    this.config = config
  }

  /**
   * Get valid OAuth2 access token (refresh if expired)
   */
  private async getAccessToken(): Promise<string> {
    // Check if current token is still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    // Refresh access token
    const { client_id, client_secret, refresh_token } = this.config.credentials

    if (!client_id || !client_secret || !refresh_token) {
      throw new Error('Google OAuth credentials not configured')
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id,
          client_secret,
          refresh_token,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Token refresh failed: ${response.status} ${error}`)
      }

      const data = await response.json()

      this.accessToken = data.access_token
      this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000 // Refresh 1 min before expiry

      return this.accessToken
    } catch (error: any) {
      console.error('Google token refresh failed:', error)
      throw error
    }
  }

  /**
   * Check availability using Google Calendar freebusy endpoint
   */
  async checkAvailability(params: AvailabilityRequest): Promise<AvailabilityResult> {
    try {
      const accessToken = await this.getAccessToken()

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/freeBusy',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timeMin: new Date(params.start_date).toISOString(),
            timeMax: new Date(params.end_date).toISOString(),
            timeZone: params.timezone || 'UTC',
            items: [{ id: this.config.calendarId }],
          }),
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Google Calendar API error: ${response.status} ${error}`)
      }

      const data = await response.json()

      const busySlots: TimeSlot[] = (
        data.calendars?.[this.config.calendarId]?.busy || []
      ).map((slot: any) => ({
        start: slot.start,
        end: slot.end,
        available: false,
        timezone: params.timezone || 'UTC',
      }))

      // Generate available slots (simplified version - production should use business hours)
      const availableSlots = this.generateAvailableSlots(
        params.start_date,
        params.end_date,
        busySlots,
        params.duration_minutes || 30,
        params.timezone || 'UTC'
      )

      return {
        slots: [...availableSlots, ...busySlots],
        timezone: params.timezone || 'UTC',
        duration_minutes: params.duration_minutes || 30,
      }
    } catch (error: any) {
      console.error('Google Calendar availability check failed:', error)
      throw error
    }
  }

  /**
   * Book an appointment by creating a Google Calendar event
   */
  async bookAppointment(params: BookAppointmentRequest): Promise<BookAppointmentResult> {
    try {
      const accessToken = await this.getAccessToken()

      const eventEnd = params.end_time || new Date(
        new Date(params.start_time).getTime() + 30 * 60000
      ).toISOString()

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${this.config.calendarId}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: `Appointment with ${params.customer_name}`,
            description: params.notes || '',
            start: {
              dateTime: params.start_time,
              timeZone: params.timezone,
            },
            end: {
              dateTime: eventEnd,
              timeZone: params.timezone,
            },
            attendees: params.customer_email
              ? [
                  {
                    email: params.customer_email,
                    displayName: params.customer_name,
                  },
                ]
              : [],
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'email', minutes: 60 },
                { method: 'popup', minutes: 15 },
              ],
            },
            extendedProperties: {
              private: {
                customer_phone: params.customer_phone || '',
              },
            },
          }),
        }
      )

      if (!response.ok) {
        const error = await response.text()
        return {
          success: false,
          error: `Google Calendar booking failed: ${response.status} ${error}`,
        }
      }

      const data = await response.json()

      const booking: Booking = {
        id: data.id,
        provider: 'google-calendar',
        customer_name: params.customer_name,
        customer_email: params.customer_email,
        customer_phone: params.customer_phone,
        start_time: data.start.dateTime,
        end_time: data.end.dateTime,
        timezone: params.timezone,
        status: 'confirmed',
        notes: params.notes,
        meeting_url: data.hangoutLink,
        created_at: data.created,
        updated_at: data.updated,
      }

      return {
        success: true,
        booking,
      }
    } catch (error: any) {
      console.error('Google Calendar booking failed:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Cancel a booking by deleting the Google Calendar event
   */
  async cancelAppointment(params: CancelAppointmentRequest): Promise<CancelAppointmentResult> {
    try {
      const accessToken = await this.getAccessToken()

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${this.config.calendarId}/events/${params.booking_id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok && response.status !== 204) {
        const error = await response.text()
        return {
          success: false,
          error: `Google Calendar cancellation failed: ${response.status} ${error}`,
        }
      }

      return {
        success: true,
      }
    } catch (error: any) {
      console.error('Google Calendar cancellation failed:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get a single booking by event ID
   */
  async getBooking(bookingId: string): Promise<Booking | null> {
    try {
      const accessToken = await this.getAccessToken()

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${this.config.calendarId}/events/${bookingId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        return null
      }

      const data = await response.json()

      return {
        id: data.id,
        provider: 'google-calendar',
        customer_name: data.attendees?.[0]?.displayName || data.summary || 'Unknown',
        customer_email: data.attendees?.[0]?.email,
        customer_phone: data.extendedProperties?.private?.customer_phone,
        start_time: data.start.dateTime,
        end_time: data.end.dateTime,
        timezone: data.start.timeZone || 'UTC',
        status: data.status === 'confirmed' ? 'confirmed' : data.status === 'cancelled' ? 'cancelled' : 'pending',
        notes: data.description,
        meeting_url: data.hangoutLink,
        created_at: data.created,
        updated_at: data.updated,
      }
    } catch (error: any) {
      console.error('Google Calendar get booking failed:', error)
      return null
    }
  }

  /**
   * List bookings (upcoming events)
   */
  async listBookings(params: ListBookingsRequest): Promise<ListBookingsResult> {
    try {
      const accessToken = await this.getAccessToken()

      const queryParams: Record<string, string> = {
        maxResults: String(params.limit || 50),
        singleEvents: 'true',
        orderBy: 'startTime',
      }

      if (params.start_date) {
        queryParams.timeMin = new Date(params.start_date).toISOString()
      } else {
        queryParams.timeMin = new Date().toISOString()
      }

      if (params.end_date) {
        queryParams.timeMax = new Date(params.end_date).toISOString()
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${this.config.calendarId}/events?` +
          new URLSearchParams(queryParams),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Google Calendar list bookings failed: ${response.status}`)
      }

      const data = await response.json()

      const bookings: Booking[] = (data.items || [])
        .filter((event: any) => {
          // Filter by status if specified
          if (params.status && params.status !== 'all') {
            if (params.status === 'confirmed' && event.status !== 'confirmed') return false
            if (params.status === 'cancelled' && event.status !== 'cancelled') return false
          }
          return true
        })
        .map((event: any) => ({
          id: event.id,
          provider: 'google-calendar',
          customer_name: event.attendees?.[0]?.displayName || event.summary || 'Unknown',
          customer_email: event.attendees?.[0]?.email,
          customer_phone: event.extendedProperties?.private?.customer_phone,
          start_time: event.start.dateTime || event.start.date,
          end_time: event.end.dateTime || event.end.date,
          timezone: event.start.timeZone || 'UTC',
          status: event.status === 'confirmed' ? 'confirmed' : event.status === 'cancelled' ? 'cancelled' : 'pending',
          notes: event.description,
          meeting_url: event.hangoutLink,
          created_at: event.created,
          updated_at: event.updated,
        }))

      return {
        bookings,
        total: bookings.length,
        has_more: !!data.nextPageToken,
      }
    } catch (error: any) {
      console.error('Google Calendar list bookings failed:', error)
      return {
        bookings: [],
        total: 0,
        has_more: false,
      }
    }
  }

  /**
   * Health check - verify Google Calendar API connectivity
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const accessToken = await this.getAccessToken()

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${this.config.calendarId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        return {
          healthy: false,
          error: `Google Calendar API returned ${response.status}`,
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

  /**
   * Helper: Generate available time slots based on business hours
   * Simplified version - production should use configurable business hours
   */
  private generateAvailableSlots(
    startDate: string,
    endDate: string,
    busySlots: TimeSlot[],
    durationMinutes: number,
    timezone: string
  ): TimeSlot[] {
    const slots: TimeSlot[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)

    // Business hours: 9 AM - 5 PM (simplified)
    let current = new Date(start)
    current.setHours(9, 0, 0, 0)

    while (current < end) {
      const slotEnd = new Date(current.getTime() + durationMinutes * 60000)

      // Check if slot overlaps with any busy slot
      const isOverlapping = busySlots.some((busy) => {
        const busyStart = new Date(busy.start)
        const busyEnd = new Date(busy.end)
        return (
          (current >= busyStart && current < busyEnd) ||
          (slotEnd > busyStart && slotEnd <= busyEnd) ||
          (current <= busyStart && slotEnd >= busyEnd)
        )
      })

      if (!isOverlapping && current.getHours() >= 9 && slotEnd.getHours() <= 17) {
        slots.push({
          start: current.toISOString(),
          end: slotEnd.toISOString(),
          available: true,
          timezone,
        })
      }

      // Move to next slot (30 min intervals)
      current = new Date(current.getTime() + 30 * 60000)

      // Reset to next day at 9 AM if we've passed 5 PM
      if (current.getHours() >= 17) {
        current.setDate(current.getDate() + 1)
        current.setHours(9, 0, 0, 0)
      }
    }

    return slots
  }
}
