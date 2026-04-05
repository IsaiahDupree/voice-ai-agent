/**
 * Feature 195: Easy!Appointments Scheduling Provider
 * Implementation of SchedulingProvider for Easy!Appointments REST API
 * Docs: https://easyappointments.org/docs/rest-api.html
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

interface EasyAppointmentsConfig {
  apiUrl: string // Base URL (e.g., "https://your-domain.com/easyappointments")
  apiKey: string // API token
  serviceId?: string // Default service ID
}

export class EasyAppointmentsProvider implements SchedulingProvider {
  readonly name = 'easyappointments'
  private config: EasyAppointmentsConfig

  constructor(config: EasyAppointmentsConfig) {
    this.config = config
  }

  /**
   * Check availability using Easy!Appointments availabilities endpoint
   */
  async checkAvailability(params: AvailabilityRequest): Promise<AvailabilityResult> {
    const serviceId = params.event_type_id || this.config.serviceId

    if (!serviceId) {
      throw new Error('service_id is required for Easy!Appointments availability check')
    }

    try {
      // Easy!Appointments expects date format YYYY-MM-DD
      const startDate = params.start_date.split('T')[0]

      const response = await fetch(
        `${this.config.apiUrl}/index.php/api/v1/availabilities?` +
          new URLSearchParams({
            service_id: serviceId,
            date: startDate,
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
        throw new Error(`Easy!Appointments API error: ${response.status} ${error}`)
      }

      const data = await response.json()

      // Transform Easy!Appointments slots to our format
      const slots: TimeSlot[] = (data || []).map((slot: string) => {
        const startTime = new Date(slot)
        const endTime = new Date(
          startTime.getTime() + (params.duration_minutes || 30) * 60000
        )

        return {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          available: true,
          timezone: params.timezone || 'UTC',
        }
      })

      return {
        slots,
        timezone: params.timezone || 'UTC',
        duration_minutes: params.duration_minutes || 30,
      }
    } catch (error: any) {
      console.error('Easy!Appointments availability check failed:', error)
      throw error
    }
  }

  /**
   * Book an appointment via Easy!Appointments appointments endpoint
   */
  async bookAppointment(params: BookAppointmentRequest): Promise<BookAppointmentResult> {
    const serviceId = params.event_type_id || this.config.serviceId

    if (!serviceId) {
      throw new Error('service_id is required for Easy!Appointments booking')
    }

    try {
      // First, get provider ID (required by Easy!Appointments)
      const providerId = await this.getProviderForService(serviceId)

      if (!providerId) {
        return {
          success: false,
          error: 'No provider available for this service',
        }
      }

      const response = await fetch(
        `${this.config.apiUrl}/index.php/api/v1/appointments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            start: params.start_time,
            end: params.end_time || new Date(
              new Date(params.start_time).getTime() + 30 * 60000
            ).toISOString(),
            service_id: parseInt(serviceId),
            provider_id: providerId,
            customer: {
              first_name: params.customer_name.split(' ')[0] || params.customer_name,
              last_name: params.customer_name.split(' ').slice(1).join(' ') || '',
              email: params.customer_email || '',
              phone: params.customer_phone || '',
              notes: params.notes || '',
              timezone: params.timezone,
            },
          }),
        }
      )

      if (!response.ok) {
        const error = await response.text()
        return {
          success: false,
          error: `Easy!Appointments booking failed: ${response.status} ${error}`,
        }
      }

      const data = await response.json()

      const booking: Booking = {
        id: String(data.id),
        provider: 'easyappointments',
        customer_name: params.customer_name,
        customer_email: params.customer_email,
        customer_phone: params.customer_phone,
        start_time: data.start,
        end_time: data.end,
        timezone: params.timezone,
        status: 'confirmed',
        notes: params.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      return {
        success: true,
        booking,
      }
    } catch (error: any) {
      console.error('Easy!Appointments booking failed:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Cancel a booking via Easy!Appointments API
   */
  async cancelAppointment(params: CancelAppointmentRequest): Promise<CancelAppointmentResult> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/index.php/api/v1/appointments/${params.booking_id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const error = await response.text()
        return {
          success: false,
          error: `Easy!Appointments cancellation failed: ${response.status} ${error}`,
        }
      }

      return {
        success: true,
      }
    } catch (error: any) {
      console.error('Easy!Appointments cancellation failed:', error)
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
      const response = await fetch(
        `${this.config.apiUrl}/index.php/api/v1/appointments/${bookingId}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        return null
      }

      const data = await response.json()

      // Fetch customer details
      const customerResponse = await fetch(
        `${this.config.apiUrl}/index.php/api/v1/customers/${data.customer_id}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const customer = customerResponse.ok ? await customerResponse.json() : {}

      return {
        id: String(data.id),
        provider: 'easyappointments',
        customer_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown',
        customer_email: customer.email,
        customer_phone: customer.phone,
        start_time: data.start,
        end_time: data.end,
        timezone: customer.timezone || 'UTC',
        status: 'confirmed',
        notes: data.notes || customer.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    } catch (error: any) {
      console.error('Easy!Appointments get booking failed:', error)
      return null
    }
  }

  /**
   * List bookings
   */
  async listBookings(params: ListBookingsRequest): Promise<ListBookingsResult> {
    try {
      const queryParams: Record<string, string> = {
        limit: String(params.limit || 50),
        offset: String(params.offset || 0),
      }

      if (params.start_date) {
        queryParams.start = params.start_date
      }

      if (params.end_date) {
        queryParams.end = params.end_date
      }

      const response = await fetch(
        `${this.config.apiUrl}/index.php/api/v1/appointments?` +
          new URLSearchParams(queryParams),
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Easy!Appointments list bookings failed: ${response.status}`)
      }

      const data = await response.json()

      // Fetch customer details for each appointment (batched if possible)
      const bookings: Booking[] = await Promise.all(
        (data || []).map(async (apt: any) => {
          try {
            const customerResponse = await fetch(
              `${this.config.apiUrl}/index.php/api/v1/customers/${apt.customer_id}`,
              {
                headers: {
                  Authorization: `Bearer ${this.config.apiKey}`,
                  'Content-Type': 'application/json',
                },
              }
            )

            const customer = customerResponse.ok ? await customerResponse.json() : {}

            return {
              id: String(apt.id),
              provider: 'easyappointments',
              customer_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown',
              customer_email: customer.email,
              customer_phone: customer.phone,
              start_time: apt.start,
              end_time: apt.end,
              timezone: customer.timezone || 'UTC',
              status: 'confirmed',
              notes: apt.notes || customer.notes,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          } catch {
            return {
              id: String(apt.id),
              provider: 'easyappointments',
              customer_name: 'Unknown',
              start_time: apt.start,
              end_time: apt.end,
              timezone: 'UTC',
              status: 'confirmed',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          }
        })
      )

      return {
        bookings,
        total: bookings.length,
        has_more: bookings.length >= (params.limit || 50),
      }
    } catch (error: any) {
      console.error('Easy!Appointments list bookings failed:', error)
      return {
        bookings: [],
        total: 0,
        has_more: false,
      }
    }
  }

  /**
   * Health check - verify Easy!Appointments API connectivity
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/index.php/api/v1/services`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        return {
          healthy: false,
          error: `Easy!Appointments API returned ${response.status}`,
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
   * Helper: Get provider ID for a service
   */
  private async getProviderForService(serviceId: string): Promise<number | null> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/index.php/api/v1/providers`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        return null
      }

      const providers = await response.json()

      // Find first provider that offers this service
      for (const provider of providers) {
        if (provider.services && provider.services.includes(parseInt(serviceId))) {
          return provider.id
        }
      }

      // Fallback: return first provider
      return providers[0]?.id || null
    } catch (error) {
      console.error('Failed to get provider for service:', error)
      return null
    }
  }
}
