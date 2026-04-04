// F0270-F0302: Cal.com API integration

import axios, { AxiosInstance, AxiosError } from 'axios'
import { isCalcomSandbox, getCalcomBaseUrl } from './test-mode'
import { excludeHolidays, type Holiday } from './holiday-exclusions'
import { availabilityCache } from './availability-cache'

// F0322: Cal.com rate limiting - exponential backoff retry
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      const isRateLimited = error.response?.status === 429
      const isLastAttempt = attempt === maxRetries

      if (!isRateLimited || isLastAttempt) {
        throw error
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(`Rate limited by Cal.com (429), retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error('Max retries exceeded')
}

// F0270: Cal.com API key from env
const CALCOM_API_KEY = process.env.CALCOM_API_KEY || ''

// F0271: Cal.com base URL
// F1187: Cal.com sandbox mode - uses sandbox API when CALCOM_SANDBOX=true
// F0332: Pin to Cal.com API v1
const CALCOM_BASE_URL = getCalcomBaseUrl()
const CALCOM_API_VERSION = 'v1' // F0332: Pinned to v1 for stability
export const SANDBOX_MODE = isCalcomSandbox()

export interface CalComSlot {
  time: string // ISO8601 datetime - F0275
}

export interface CalComEventType {
  id: number
  title: string
  slug: string
  length: number
  description?: string
  // F0324: Buffer settings
  beforeEventBuffer?: number // minutes
  afterEventBuffer?: number // minutes
}

export interface CalComBooking {
  id: number
  uid: string
  title: string
  startTime: string
  endTime: string
  status: string
  attendees: Array<{
    name: string
    email: string
    timeZone: string
  }>
}

export interface BookingParams {
  eventTypeId: number
  start: string // ISO8601
  name: string
  email: string
  phone?: string
  notes?: string
  timeZone?: string
  metadata?: Record<string, any>
  // F0343: Additional metadata fields
  contactId?: string
  callId?: string
  location?: string // F0418: Custom location for booking
}

class CalComClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: CALCOM_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CALCOM_API_KEY}`,
        'Cal-API-Version': CALCOM_API_VERSION, // F0332: Pin API version
      },
      timeout: 10000,
    })
  }

  // F0272: Get event types
  async getEventTypes(): Promise<CalComEventType[]> {
    return retryWithBackoff(async () => {
      try {
        const response = await this.client.get('/event-types')
        return response.data.event_types || []
      } catch (error: any) {
        console.error('Error fetching Cal.com event types:', error.response?.data || error.message)
        throw new Error(`Failed to get event types: ${error.response?.data?.message || error.message}`)
      }
    })
  }

  // F0324: Get single event type with buffer settings
  async getEventType(eventTypeId: number): Promise<CalComEventType> {
    return retryWithBackoff(async () => {
      try {
        const response = await this.client.get(`/event-types/${eventTypeId}`)
        const eventType = response.data.event_type

        return {
          id: eventType.id,
          title: eventType.title,
          slug: eventType.slug,
          length: eventType.length,
          description: eventType.description,
          beforeEventBuffer: eventType.beforeEventBuffer || 0,
          afterEventBuffer: eventType.afterEventBuffer || 0,
        }
      } catch (error: any) {
        console.error('Error fetching Cal.com event type:', error.response?.data || error.message)
        throw new Error(`Failed to get event type: ${error.response?.data?.message || error.message}`)
      }
    })
  }

  // F0273: Get availability for a specific event type and date
  // F0326: Holiday exclusions applied
  // F0329: Cache with invalidation
  async getAvailability(eventTypeId: number, date: string, customHolidays?: Holiday[], useCache: boolean = true): Promise<CalComSlot[]> {
    // F0329: Check cache first
    if (useCache) {
      const cached = availabilityCache.get(eventTypeId, date)
      if (cached) {
        return cached
      }
    }

    return retryWithBackoff(async () => {
      try {
        const response = await this.client.get('/availability', {
          params: {
            eventTypeId,
            dateFrom: date,
            dateTo: date,
          },
        })

        // F0275: Slots returned as ISO8601 datetime strings
        let slots = response.data.slots || []
        slots = slots.map((slot: any) => ({
          time: slot.time,
        }))

        // F0326: Exclude holidays from availability
        slots = excludeHolidays(slots, customHolidays)

        // F0329: Store in cache
        if (useCache) {
          availabilityCache.set(eventTypeId, date, slots)
        }

        return slots
      } catch (error: any) {
        console.error('Error fetching Cal.com availability:', error.response?.data || error.message)
        throw new Error(`Failed to get availability: ${error.response?.data?.message || error.message}`)
      }
    })
  }

  // F0274: Get availability for next 7 days
  // F0326: Holiday exclusions applied
  async getAvailabilityWindow(
    eventTypeId: number,
    timezone: string = 'America/New_York',
    customHolidays?: Holiday[]
  ): Promise<Record<string, CalComSlot[]>> {
    try {
      const today = new Date();
      const sevenDaysLater = new Date(today);
      sevenDaysLater.setDate(today.getDate() + 7);

      const response = await this.client.get('/availability', {
        params: {
          eventTypeId,
          dateFrom: today.toISOString().split('T')[0],
          dateTo: sevenDaysLater.toISOString().split('T')[0],
          timeZone: timezone
        },
      });

      // F0276: Slots returned in caller's detected timezone
      let allSlots = response.data.slots || [];

      // F0326: Exclude holidays from all slots
      allSlots = excludeHolidays(
        allSlots.map((s: any) => ({ time: s.time })),
        customHolidays
      );

      // Group slots by date
      const slotsByDate: Record<string, CalComSlot[]> = {};

      allSlots.forEach((slot: any) => {
        const date = slot.time.split('T')[0]; // Extract date part
        if (!slotsByDate[date]) {
          slotsByDate[date] = [];
        }
        slotsByDate[date].push({ time: slot.time });
      });

      return slotsByDate;
    } catch (error: any) {
      console.error('Error fetching Cal.com availability window:', error.response?.data || error.message);
      throw new Error(`Failed to get availability window: ${error.response?.data?.message || error.message}`);
    }
  }

  // F0278: Book appointment
  // F0279: Booking required fields - name, email, startTime, eventTypeId
  // F0322: Rate limiting handled with exponential backoff
  async createBooking(params: BookingParams): Promise<CalComBooking> {
    // F0279: Validate required fields
    if (!params.name || !params.email || !params.start || !params.eventTypeId) {
      throw new Error('Missing required fields: name, email, start, eventTypeId')
    }

    // F1187: Sandbox mode - return mock booking instead of real API call
    if (SANDBOX_MODE) {
      console.log('[CAL.COM SANDBOX] Simulating booking creation:', params)

      const mockBooking: CalComBooking = {
        id: Math.floor(Math.random() * 100000),
        uid: `sandbox-${Date.now()}`,
        title: `Test Booking - ${params.name}`,
        startTime: params.start,
        endTime: new Date(new Date(params.start).getTime() + 30 * 60000).toISOString(), // 30 min meeting
        status: 'accepted',
        attendees: [
          {
            name: params.name,
            email: params.email,
            timeZone: params.timeZone || 'America/New_York'
          }
        ]
      }

      return mockBooking
    }

    return retryWithBackoff(async () => {
      try {
        // F0277: Buffer time - Cal.com respects buffer time configured in event type settings
        // F0290: Conflict check - Cal.com API automatically handles this

        // F0333: Tag booking with source
        // F0343: Store contact_id and call_id in metadata
        const bookingMetadata = {
          source: 'voice_agent', // F0333
          ...(params.contactId && { contact_id: params.contactId }), // F0343
          ...(params.callId && { call_id: params.callId }), // F0343
          ...params.metadata,
        }

        const response = await this.client.post('/bookings', {
          eventTypeId: params.eventTypeId,
          start: params.start,
          responses: {
            name: params.name,
            email: params.email,
            ...(params.phone && { phone: params.phone }), // F0280: Booking phone field
            ...(params.notes && { notes: params.notes }), // F0281: Booking notes field
          },
          timeZone: params.timeZone || 'America/New_York', // F0276: Slot timezone
          metadata: bookingMetadata,
        })

        const booking = response.data

        // F0282: Booking confirmation email - Cal.com sends automatically
        // F0283: Booking confirmation SMS - handled separately by our system

        // F0329: Invalidate availability cache for the booked date
        const bookingDate = params.start.split('T')[0]
        availabilityCache.invalidate(params.eventTypeId, bookingDate)

        return booking
      } catch (error: any) {
        console.error('Error creating Cal.com booking:', error.response?.data || error.message)

        // F0291: Conflict error message - detect booking conflicts
        if (error.response?.status === 409 || error.response?.data?.message?.includes('conflict')) {
          throw new Error('BOOKING_CONFLICT: The selected time slot is no longer available')
        }

        throw new Error(`Failed to create booking: ${error.response?.data?.message || error.message}`)
      }
    })
  }

  // Get booking by ID
  async getBooking(bookingId: string): Promise<CalComBooking> {
    try {
      const response = await this.client.get(`/bookings/${bookingId}`)
      return response.data
    } catch (error: any) {
      console.error('Error fetching Cal.com booking:', error.response?.data || error.message)
      throw new Error(`Failed to get booking: ${error.response?.data?.message || error.message}`)
    }
  }

  // Cancel booking
  async cancelBooking(bookingId: string, reason?: string): Promise<void> {
    try {
      await this.client.delete(`/bookings/${bookingId}`, {
        data: { reason },
      })
    } catch (error: any) {
      console.error('Error cancelling Cal.com booking:', error.response?.data || error.message)
      throw new Error(`Failed to cancel booking: ${error.response?.data?.message || error.message}`)
    }
  }

  // Reschedule booking
  async rescheduleBooking(bookingId: string, newStart: string): Promise<CalComBooking> {
    try {
      const response = await this.client.patch(`/bookings/${bookingId}`, {
        start: newStart,
      })
      return response.data
    } catch (error: any) {
      console.error('Error rescheduling Cal.com booking:', error.response?.data || error.message)
      throw new Error(`Failed to reschedule booking: ${error.response?.data?.message || error.message}`)
    }
  }

  // F0300: Cal.com health check
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.client.get('/event-types', { timeout: 5000 })
      return { healthy: true }
    } catch (error: any) {
      return {
        healthy: false,
        message: error.response?.data?.message || error.message || 'Cal.com unreachable',
      }
    }
  }
}

export const calcomClient = new CalComClient()
