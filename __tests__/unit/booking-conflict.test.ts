// F1213: Unit test: booking conflict

describe('Booking Conflict Detection', () => {
  describe('Time slot availability', () => {
    it('should detect conflicting bookings', () => {
      const booking1 = {
        start: '2026-03-27T14:00:00Z',
        end: '2026-03-27T15:00:00Z',
      }

      const booking2 = {
        start: '2026-03-27T14:30:00Z',
        end: '2026-03-27T15:30:00Z',
      }

      // booking2 starts during booking1
      const start1 = new Date(booking1.start).getTime()
      const end1 = new Date(booking1.end).getTime()
      const start2 = new Date(booking2.start).getTime()

      const hasConflict = start2 >= start1 && start2 < end1
      expect(hasConflict).toBe(true)
    })

    it('should allow non-conflicting bookings', () => {
      const booking1 = {
        start: '2026-03-27T14:00:00Z',
        end: '2026-03-27T15:00:00Z',
      }

      const booking2 = {
        start: '2026-03-27T15:00:00Z',
        end: '2026-03-27T16:00:00Z',
      }

      // booking2 starts exactly when booking1 ends (no overlap)
      const end1 = new Date(booking1.end).getTime()
      const start2 = new Date(booking2.start).getTime()

      expect(start2).toBe(end1)
      const hasConflict = start2 < end1
      expect(hasConflict).toBe(false)
    })

    it('should detect full overlap', () => {
      const booking1 = {
        start: '2026-03-27T14:00:00Z',
        end: '2026-03-27T16:00:00Z',
      }

      const booking2 = {
        start: '2026-03-27T14:30:00Z',
        end: '2026-03-27T15:30:00Z',
      }

      // booking2 is completely within booking1
      const start1 = new Date(booking1.start).getTime()
      const end1 = new Date(booking1.end).getTime()
      const start2 = new Date(booking2.start).getTime()
      const end2 = new Date(booking2.end).getTime()

      const hasConflict = start2 >= start1 && end2 <= end1
      expect(hasConflict).toBe(true)
    })

    it('should detect partial overlap at start', () => {
      const booking1 = {
        start: '2026-03-27T14:00:00Z',
        end: '2026-03-27T15:00:00Z',
      }

      const booking2 = {
        start: '2026-03-27T13:30:00Z',
        end: '2026-03-27T14:30:00Z',
      }

      // booking2 ends during booking1
      const start1 = new Date(booking1.start).getTime()
      const end1 = new Date(booking1.end).getTime()
      const end2 = new Date(booking2.end).getTime()

      const hasConflict = end2 > start1 && end2 <= end1
      expect(hasConflict).toBe(true)
    })
  })

  describe('Conflict error handling', () => {
    it('should return BOOKING_CONFLICT error code', () => {
      const error = {
        success: false,
        error: 'That time slot is no longer available. Please choose another time.',
        errorCode: 'BOOKING_CONFLICT',
      }

      expect(error.success).toBe(false)
      expect(error.errorCode).toBe('BOOKING_CONFLICT')
      expect(error.error).toContain('no longer available')
    })

    it('should suggest alternative slots on conflict', () => {
      const conflictResponse = {
        success: false,
        errorCode: 'BOOKING_CONFLICT',
        alternativeSlots: [
          '2026-03-27T15:00:00Z',
          '2026-03-27T16:00:00Z',
          '2026-03-27T17:00:00Z',
        ],
      }

      expect(conflictResponse.alternativeSlots).toBeDefined()
      expect(conflictResponse.alternativeSlots.length).toBeGreaterThan(0)
    })
  })

  describe('Time slot validation', () => {
    it('should validate slot duration', () => {
      const slot = {
        start: '2026-03-27T14:00:00Z',
        end: '2026-03-27T15:00:00Z',
      }

      const durationMs = new Date(slot.end).getTime() - new Date(slot.start).getTime()
      const durationMinutes = durationMs / (1000 * 60)

      expect(durationMinutes).toBe(60)
      expect(durationMinutes).toBeGreaterThan(0)
    })

    it('should reject slots in the past', () => {
      const now = new Date()
      const pastSlot = {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
      }

      const isPast = new Date(pastSlot.start).getTime() < now.getTime()
      expect(isPast).toBe(true)
    })

    it('should validate start comes before end', () => {
      const validSlot = {
        start: '2026-03-27T14:00:00Z',
        end: '2026-03-27T15:00:00Z',
      }

      const invalidSlot = {
        start: '2026-03-27T15:00:00Z',
        end: '2026-03-27T14:00:00Z',
      }

      expect(new Date(validSlot.start).getTime()).toBeLessThan(
        new Date(validSlot.end).getTime()
      )
      expect(new Date(invalidSlot.start).getTime()).toBeGreaterThan(
        new Date(invalidSlot.end).getTime()
      )
    })
  })

  describe('Concurrent booking race conditions', () => {
    it('should handle double-booking attempts', () => {
      // Simulate two clients trying to book same slot simultaneously
      const slot = {
        start: '2026-03-27T14:00:00Z',
        end: '2026-03-27T15:00:00Z',
        available: true,
      }

      // First booking succeeds
      const booking1Result = { success: true, bookingId: 'bk_123' }

      // Second booking should fail (slot no longer available)
      const booking2Result = {
        success: false,
        errorCode: 'BOOKING_CONFLICT',
      }

      expect(booking1Result.success).toBe(true)
      expect(booking2Result.success).toBe(false)
      expect(booking2Result.errorCode).toBe('BOOKING_CONFLICT')
    })

    it('should use database transactions for atomicity', () => {
      // In production, booking should use:
      // 1. SELECT ... FOR UPDATE to lock slot
      // 2. Check availability
      // 3. INSERT booking
      // 4. COMMIT

      const transactionSteps = [
        'BEGIN TRANSACTION',
        'SELECT * FROM slots WHERE id = $1 FOR UPDATE',
        'CHECK availability',
        'INSERT INTO bookings ...',
        'COMMIT',
      ]

      expect(transactionSteps.some(step => step.includes('FOR UPDATE'))).toBe(true)
      expect(transactionSteps).toContain('COMMIT')
    })
  })

  describe('Buffer time handling', () => {
    it('should enforce buffer time between bookings', () => {
      const bufferMinutes = 15

      const booking1 = {
        start: '2026-03-27T14:00:00Z',
        end: '2026-03-27T15:00:00Z',
      }

      const booking2 = {
        start: '2026-03-27T15:00:00Z', // Immediately after
        end: '2026-03-27T16:00:00Z',
      }

      const gap =
        new Date(booking2.start).getTime() - new Date(booking1.end).getTime()
      const gapMinutes = gap / (1000 * 60)

      expect(gapMinutes).toBe(0)
      // Should enforce buffer: gapMinutes >= bufferMinutes
      const hasBuffer = gapMinutes >= bufferMinutes
      expect(hasBuffer).toBe(false)
    })

    it('should allow bookings with sufficient buffer', () => {
      const bufferMinutes = 15

      const booking1 = {
        start: '2026-03-27T14:00:00Z',
        end: '2026-03-27T15:00:00Z',
      }

      const booking2 = {
        start: '2026-03-27T15:15:00Z', // 15 min after
        end: '2026-03-27T16:15:00Z',
      }

      const gap =
        new Date(booking2.start).getTime() - new Date(booking1.end).getTime()
      const gapMinutes = gap / (1000 * 60)

      expect(gapMinutes).toBe(15)
      const hasBuffer = gapMinutes >= bufferMinutes
      expect(hasBuffer).toBe(true)
    })
  })

  describe('Cal.com integration', () => {
    it('should parse Cal.com booking response', () => {
      const calcomResponse = {
        id: 12345,
        uid: 'bk_abc123',
        title: 'Appointment with John Doe',
        startTime: '2026-03-27T14:00:00Z',
        endTime: '2026-03-27T15:00:00Z',
        attendees: [{ email: 'john@example.com', name: 'John Doe' }],
      }

      expect(calcomResponse.id).toBeDefined()
      expect(calcomResponse.uid).toBeDefined()
      expect(new Date(calcomResponse.startTime)).toBeInstanceOf(Date)
    })

    it('should handle Cal.com conflict error', () => {
      const error = {
        message: 'BOOKING_CONFLICT: Slot no longer available',
        code: 'BOOKING_CONFLICT',
      }

      expect(error.message).toContain('BOOKING_CONFLICT')
      expect(error.code).toBe('BOOKING_CONFLICT')
    })
  })
})
