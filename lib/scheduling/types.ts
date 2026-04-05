/**
 * Feature 192: Scheduling Provider Interface
 * Abstract interface for booking appointments across different platforms
 * Supports: Cal.com, Easy!Appointments, Google Calendar
 */

/**
 * Time slot availability
 */
export interface TimeSlot {
  start: string // ISO 8601 datetime
  end: string // ISO 8601 datetime
  available: boolean
  timezone?: string
}

/**
 * Booking details
 */
export interface Booking {
  id: string
  provider: string // 'calcom' | 'easyappointments' | 'google-calendar'
  customer_name: string
  customer_email?: string
  customer_phone?: string
  start_time: string // ISO 8601
  end_time: string // ISO 8601
  timezone: string
  status: 'confirmed' | 'pending' | 'cancelled'
  notes?: string
  location?: string
  meeting_url?: string
  created_at: string
  updated_at: string
}

/**
 * Availability check parameters
 */
export interface AvailabilityRequest {
  start_date: string // ISO 8601 date (e.g., "2026-04-05")
  end_date: string // ISO 8601 date
  duration_minutes?: number // Default: 30
  timezone?: string // IANA timezone (e.g., "America/New_York")
  event_type_id?: string // Cal.com event type ID or service ID
}

/**
 * Availability check result
 */
export interface AvailabilityResult {
  slots: TimeSlot[]
  timezone: string
  duration_minutes: number
}

/**
 * Booking creation parameters
 */
export interface BookAppointmentRequest {
  customer_name: string
  customer_email?: string
  customer_phone?: string
  start_time: string // ISO 8601
  end_time?: string // ISO 8601 (optional, can be derived from start + duration)
  timezone: string
  notes?: string
  event_type_id?: string // Cal.com event type ID or service ID
  send_confirmation?: boolean // Send email/SMS confirmation
}

/**
 * Booking creation result
 */
export interface BookAppointmentResult {
  success: boolean
  booking?: Booking
  error?: string
}

/**
 * Booking cancellation parameters
 */
export interface CancelAppointmentRequest {
  booking_id: string
  reason?: string
  send_notification?: boolean
}

/**
 * Booking cancellation result
 */
export interface CancelAppointmentResult {
  success: boolean
  error?: string
}

/**
 * List bookings parameters
 */
export interface ListBookingsRequest {
  start_date?: string // ISO 8601 date
  end_date?: string // ISO 8601 date
  status?: 'confirmed' | 'pending' | 'cancelled' | 'all'
  limit?: number
  offset?: number
}

/**
 * List bookings result
 */
export interface ListBookingsResult {
  bookings: Booking[]
  total: number
  has_more: boolean
}

/**
 * Generic scheduling provider interface
 * All scheduling platforms must implement this interface
 */
export interface SchedulingProvider {
  /**
   * Provider name (e.g., 'calcom', 'easyappointments', 'google-calendar')
   */
  readonly name: string

  /**
   * Check availability for booking
   */
  checkAvailability(params: AvailabilityRequest): Promise<AvailabilityResult>

  /**
   * Book an appointment
   */
  bookAppointment(params: BookAppointmentRequest): Promise<BookAppointmentResult>

  /**
   * Cancel an appointment
   */
  cancelAppointment(params: CancelAppointmentRequest): Promise<CancelAppointmentResult>

  /**
   * Get a single booking by ID
   */
  getBooking(bookingId: string): Promise<Booking | null>

  /**
   * List bookings
   */
  listBookings(params: ListBookingsRequest): Promise<ListBookingsResult>

  /**
   * Health check - verify API credentials and connectivity
   */
  healthCheck(): Promise<{ healthy: boolean; error?: string }>
}

/**
 * Scheduling provider configuration
 */
export interface SchedulingConfig {
  provider: 'calcom' | 'easyappointments' | 'google-calendar'
  apiKey?: string
  apiUrl?: string
  eventTypeId?: string
  serviceId?: string
  credentials?: Record<string, any> // Provider-specific credentials
}
