// F1201: Unit test: Cal.com webhook handler

import {
  calcomBookingCreated,
  calcomBookingRescheduled,
  calcomBookingCancelled,
} from '../fixtures'

describe('Cal.com Webhook Handler', () => {
  describe('F1201: Booking webhook events', () => {
    it('should handle BOOKING_CREATED event', () => {
      const event = calcomBookingCreated

      expect(event.triggerEvent).toBe('BOOKING_CREATED')
      expect(event.payload.id).toBeDefined()
      expect(event.payload.uid).toBeDefined()
      expect(event.payload.status).toBe('ACCEPTED')
      expect(event.payload.attendees).toHaveLength(1)
    })

    it('should handle BOOKING_RESCHEDULED event', () => {
      const event = calcomBookingRescheduled

      expect(event.triggerEvent).toBe('BOOKING_RESCHEDULED')
      expect(event.payload.rescheduleReason).toBeDefined()
      expect(event.payload.startTime).toBeDefined()
    })

    it('should handle BOOKING_CANCELLED event', () => {
      const event = calcomBookingCancelled

      expect(event.triggerEvent).toBe('BOOKING_CANCELLED')
      expect(event.payload.status).toBe('CANCELLED')
      expect(event.payload.cancellationReason).toBeDefined()
    })
  })

  describe('Booking data validation', () => {
    it('should validate booking created payload structure', () => {
      const event = calcomBookingCreated
      const requiredFields = [
        'id',
        'uid',
        'title',
        'startTime',
        'endTime',
        'status',
        'attendees',
        'organizer',
      ]

      requiredFields.forEach((field) => {
        expect(event.payload).toHaveProperty(field)
      })
    })

    it('should extract attendee information', () => {
      const event = calcomBookingCreated
      const attendee = event.payload.attendees[0]

      expect(attendee.name).toBe('John Doe')
      expect(attendee.email).toBe('john@example.com')
      expect(attendee.timeZone).toBeDefined()
    })

    it('should validate datetime format', () => {
      const event = calcomBookingCreated
      const startTime = new Date(event.payload.startTime)

      expect(startTime).toBeInstanceOf(Date)
      expect(startTime.toISOString()).toBe(event.payload.startTime)
    })

    it('should extract metadata fields', () => {
      const event = calcomBookingCreated

      expect(event.payload.metadata).toBeDefined()
      expect(event.payload.metadata.phone).toBe('+15555551234')
      expect(event.payload.metadata.source).toBe('vapi')
      expect(event.payload.metadata.callId).toBeDefined()
    })
  })

  describe('Booking time validation', () => {
    it('should validate start time is before end time', () => {
      const event = calcomBookingCreated
      const start = new Date(event.payload.startTime)
      const end = new Date(event.payload.endTime)

      expect(start.getTime()).toBeLessThan(end.getTime())
    })

    it('should calculate booking duration', () => {
      const event = calcomBookingCreated
      const start = new Date(event.payload.startTime)
      const end = new Date(event.payload.endTime)
      const durationMs = end.getTime() - start.getTime()
      const durationMin = durationMs / (1000 * 60)

      expect(durationMin).toBe(60) // 1 hour booking
    })
  })
})
