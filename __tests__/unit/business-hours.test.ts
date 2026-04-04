// F1205: Unit test: calling hours

import { isWithinBusinessHours, getAfterHoursMessage, BusinessHours, defaultBusinessHours } from '@/lib/business-hours'

describe('Business Hours', () => {
  describe('isWithinBusinessHours', () => {
    // Mock the current date/time for testing
    const mockDate = (dateString: string) => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date(dateString))
    }

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should return true during business hours on weekdays', () => {
      // Tuesday at 2pm
      mockDate('2026-03-24T14:00:00')
      expect(isWithinBusinessHours()).toBe(true)
    })

    it('should return true at start of business hours', () => {
      // Monday at 9am exactly
      mockDate('2026-03-23T09:00:00')
      expect(isWithinBusinessHours()).toBe(true)
    })

    it('should return false at end of business hours', () => {
      // Monday at 5pm exactly
      mockDate('2026-03-23T17:00:00')
      expect(isWithinBusinessHours()).toBe(false)
    })

    it('should return false before business hours', () => {
      // Monday at 8am
      mockDate('2026-03-23T08:00:00')
      expect(isWithinBusinessHours()).toBe(false)
    })

    it('should return false after business hours', () => {
      // Monday at 6pm
      mockDate('2026-03-23T18:00:00')
      expect(isWithinBusinessHours()).toBe(false)
    })

    it('should return false on Saturday (default config)', () => {
      // Saturday at 2pm
      mockDate('2026-03-28T14:00:00')
      expect(isWithinBusinessHours()).toBe(false)
    })

    it('should return false on Sunday (default config)', () => {
      // Sunday at 2pm
      mockDate('2026-03-29T14:00:00')
      expect(isWithinBusinessHours()).toBe(false)
    })

    it('should return false on holidays', () => {
      const config: BusinessHours = {
        ...defaultBusinessHours,
        holidays: ['2026-03-24'],
      }

      // Tuesday at 2pm, but it's a holiday
      mockDate('2026-03-24T14:00:00')
      expect(isWithinBusinessHours(config)).toBe(false)
    })

    it('should respect custom business hours', () => {
      const config: BusinessHours = {
        timezone: 'America/New_York',
        hours: {
          monday: { start: '08:00', end: '20:00' },
          tuesday: { start: '08:00', end: '20:00' },
          wednesday: { start: '08:00', end: '20:00' },
          thursday: { start: '08:00', end: '20:00' },
          friday: { start: '08:00', end: '20:00' },
          saturday: { start: '10:00', end: '16:00' },
        },
        holidays: [],
      }

      // Saturday at 2pm - should be open with custom config
      mockDate('2026-03-28T14:00:00')
      expect(isWithinBusinessHours(config)).toBe(true)

      // Monday at 7pm - should be open (extended hours)
      mockDate('2026-03-23T19:00:00')
      expect(isWithinBusinessHours(config)).toBe(true)

      // Sunday - still closed
      mockDate('2026-03-29T14:00:00')
      expect(isWithinBusinessHours(config)).toBe(false)
    })
  })

  describe('getAfterHoursMessage', () => {
    const mockDate = (dateString: string) => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date(dateString))
    }

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should return message with next business day info', () => {
      // Friday at 6pm
      mockDate('2026-03-27T18:00:00')
      const message = getAfterHoursMessage()

      expect(message).toContain('closed')
      expect(message).toContain('09:00')
      expect(message).toContain('17:00')
    })

    it('should handle weekend closure', () => {
      // Saturday at 2pm
      mockDate('2026-03-28T14:00:00')
      const message = getAfterHoursMessage()

      expect(message).toContain('closed')
      expect(message).toContain('Monday')
    })
  })
})
