/**
 * Feature 193: Scheduling Provider Factory
 * Returns the configured scheduling provider based on environment variable
 */

import type { SchedulingProvider, SchedulingConfig } from './types'
import { CalComProvider } from './calcom'
import { EasyAppointmentsProvider } from './easyappointments'
import { GoogleCalendarProvider } from './google-calendar'

/**
 * Get the active scheduling provider based on SCHEDULING_PROVIDER env var
 * Defaults to 'calcom' if not specified
 */
export function getSchedulingProvider(): SchedulingProvider {
  const providerType = (process.env.SCHEDULING_PROVIDER || 'calcom').toLowerCase()

  const config: SchedulingConfig = {
    provider: providerType as any,
    apiKey: process.env.SCHEDULING_API_KEY,
    apiUrl: process.env.SCHEDULING_API_URL,
    eventTypeId: process.env.SCHEDULING_EVENT_TYPE_ID,
    serviceId: process.env.SCHEDULING_SERVICE_ID,
  }

  switch (config.provider) {
    case 'calcom':
      return new CalComProvider({
        apiKey: config.apiKey || process.env.CALCOM_API_KEY || '',
        apiUrl: config.apiUrl || process.env.CALCOM_API_URL || 'https://api.cal.com/v1',
        eventTypeId: config.eventTypeId || process.env.CALCOM_EVENT_TYPE_ID,
      })

    case 'easyappointments':
      return new EasyAppointmentsProvider({
        apiUrl: config.apiUrl || process.env.EASYAPPOINTMENTS_API_URL || '',
        apiKey: config.apiKey || process.env.EASYAPPOINTMENTS_API_KEY || '',
        serviceId: config.serviceId || process.env.EASYAPPOINTMENTS_SERVICE_ID,
      })

    case 'google-calendar':
      return new GoogleCalendarProvider({
        credentials: {
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        },
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      })

    default:
      console.warn(`Unknown scheduling provider: ${config.provider}. Falling back to calcom.`)
      return new CalComProvider({
        apiKey: process.env.CALCOM_API_KEY || '',
        apiUrl: process.env.CALCOM_API_URL || 'https://api.cal.com/v1',
        eventTypeId: process.env.CALCOM_EVENT_TYPE_ID,
      })
  }
}

/**
 * Create a scheduling provider with custom configuration
 */
export function createSchedulingProvider(config: SchedulingConfig): SchedulingProvider {
  switch (config.provider) {
    case 'calcom':
      return new CalComProvider({
        apiKey: config.apiKey || '',
        apiUrl: config.apiUrl || 'https://api.cal.com/v1',
        eventTypeId: config.eventTypeId,
      })

    case 'easyappointments':
      return new EasyAppointmentsProvider({
        apiUrl: config.apiUrl || '',
        apiKey: config.apiKey || '',
        serviceId: config.serviceId,
      })

    case 'google-calendar':
      return new GoogleCalendarProvider({
        credentials: config.credentials || {},
        calendarId: (config.credentials as any)?.calendarId || 'primary',
      })

    default:
      throw new Error(`Unsupported scheduling provider: ${config.provider}`)
  }
}

/**
 * Validate scheduling provider environment configuration
 * Throws error if required env vars are missing
 */
export function validateSchedulingConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const provider = (process.env.SCHEDULING_PROVIDER || 'calcom').toLowerCase()

  switch (provider) {
    case 'calcom':
      if (!process.env.CALCOM_API_KEY) {
        errors.push('CALCOM_API_KEY is required for Cal.com provider')
      }
      break

    case 'easyappointments':
      if (!process.env.EASYAPPOINTMENTS_API_URL) {
        errors.push('EASYAPPOINTMENTS_API_URL is required for Easy!Appointments provider')
      }
      if (!process.env.EASYAPPOINTMENTS_API_KEY) {
        errors.push('EASYAPPOINTMENTS_API_KEY is required for Easy!Appointments provider')
      }
      break

    case 'google-calendar':
      if (!process.env.GOOGLE_CLIENT_ID) {
        errors.push('GOOGLE_CLIENT_ID is required for Google Calendar provider')
      }
      if (!process.env.GOOGLE_CLIENT_SECRET) {
        errors.push('GOOGLE_CLIENT_SECRET is required for Google Calendar provider')
      }
      if (!process.env.GOOGLE_REFRESH_TOKEN) {
        errors.push('GOOGLE_REFRESH_TOKEN is required for Google Calendar provider')
      }
      break

    default:
      errors.push(`Unknown scheduling provider: ${provider}. Must be one of: calcom, easyappointments, google-calendar`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Export provider classes for direct instantiation if needed
export { CalComProvider } from './calcom'
export { EasyAppointmentsProvider } from './easyappointments'
export { GoogleCalendarProvider } from './google-calendar'

// Export types
export type {
  SchedulingProvider,
  SchedulingConfig,
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
