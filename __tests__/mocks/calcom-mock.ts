// F1244: Mock Cal.com client for testing

/**
 * F1244: Mock Cal.com client
 */
export class MockCalcomClient {
  public bookings: any[] = []
  public availableSlots: Record<string, string[]> = {}
  private shouldError: boolean = false
  private errorMessage: string = 'Mock Cal.com error'

  /**
   * Mock check availability
   */
  async checkAvailability(params: { date: string; timezone?: string }) {
    if (this.shouldError) {
      throw new Error(this.errorMessage)
    }

    // Return pre-configured slots or default slots
    const slots = this.availableSlots[params.date] || [
      '09:00',
      '10:00',
      '14:00',
      '15:00',
    ]

    return {
      slots: {
        [params.date]: slots.map((time) => ({
          time: `${params.date}T${time}:00Z`,
          attendees: [],
          bookingUid: null,
        })),
      },
    }
  }

  /**
   * Mock create booking
   */
  async createBooking(params: {
    eventTypeId: number
    start: string
    responses: {
      name: string
      email: string
      phone?: string
    }
    timeZone?: string
    metadata?: Record<string, any>
  }) {
    if (this.shouldError) {
      throw new Error(this.errorMessage)
    }

    const booking = {
      id: Math.floor(Math.random() * 100000),
      uid: `booking_${Date.now()}`,
      title: 'Test Booking',
      startTime: params.start,
      endTime: new Date(
        new Date(params.start).getTime() + 60 * 60 * 1000
      ).toISOString(),
      status: 'ACCEPTED',
      attendees: [
        {
          name: params.responses.name,
          email: params.responses.email,
          timeZone: params.timeZone || 'UTC',
        },
      ],
      metadata: params.metadata || {},
    }

    this.bookings.push(booking)
    return booking
  }

  /**
   * Mock get booking
   */
  async getBooking(uid: string) {
    if (this.shouldError) {
      throw new Error(this.errorMessage)
    }
    return this.bookings.find((b) => b.uid === uid) || null
  }

  /**
   * Mock cancel booking
   */
  async cancelBooking(uid: string, reason?: string) {
    if (this.shouldError) {
      throw new Error(this.errorMessage)
    }

    const booking = this.bookings.find((b) => b.uid === uid)
    if (booking) {
      booking.status = 'CANCELLED'
      booking.cancellationReason = reason
      return booking
    }

    throw new Error('Booking not found')
  }

  /**
   * Mock reschedule booking
   */
  async rescheduleBooking(uid: string, newStart: string, reason?: string) {
    if (this.shouldError) {
      throw new Error(this.errorMessage)
    }

    const booking = this.bookings.find((b) => b.uid === uid)
    if (booking) {
      booking.startTime = newStart
      booking.endTime = new Date(
        new Date(newStart).getTime() + 60 * 60 * 1000
      ).toISOString()
      booking.rescheduleReason = reason
      return booking
    }

    throw new Error('Booking not found')
  }

  /**
   * Set available slots for a date
   */
  setAvailableSlots(date: string, slots: string[]) {
    this.availableSlots[date] = slots
  }

  /**
   * Force next operation to error
   */
  forceError(message: string = 'Mock Cal.com error') {
    this.shouldError = true
    this.errorMessage = message
  }

  /**
   * Clear error state
   */
  clearError() {
    this.shouldError = false
  }

  /**
   * Reset mock to initial state
   */
  reset() {
    this.bookings = []
    this.availableSlots = {}
    this.shouldError = false
    this.errorMessage = 'Mock Cal.com error'
  }
}

export const mockCalcom = new MockCalcomClient()
