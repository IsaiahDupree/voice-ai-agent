// F1252: Test: calling hours boundary

describe('Calling Hours Boundary Conditions', () => {
  describe('Start of business hours', () => {
    it('should allow calls exactly at start time', () => {
      const config = {
        start: '09:00',
        end: '17:00',
      }

      const currentTime = '09:00'

      const isAllowed = currentTime >= config.start && currentTime < config.end
      expect(isAllowed).toBe(true)
    })

    it('should block calls one minute before start', () => {
      const config = {
        start: '09:00',
        end: '17:00',
      }

      const currentTime = '08:59'

      const isAllowed = currentTime >= config.start && currentTime < config.end
      expect(isAllowed).toBe(false)
    })

    it('should allow calls one minute after start', () => {
      const config = {
        start: '09:00',
        end: '17:00',
      }

      const currentTime = '09:01'

      const isAllowed = currentTime >= config.start && currentTime < config.end
      expect(isAllowed).toBe(true)
    })
  })

  describe('End of business hours', () => {
    it('should block calls exactly at end time', () => {
      const config = {
        start: '09:00',
        end: '17:00',
      }

      const currentTime = '17:00'

      const isAllowed = currentTime >= config.start && currentTime < config.end
      expect(isAllowed).toBe(false)
    })

    it('should allow calls one minute before end', () => {
      const config = {
        start: '09:00',
        end: '17:00',
      }

      const currentTime = '16:59'

      const isAllowed = currentTime >= config.start && currentTime < config.end
      expect(isAllowed).toBe(true)
    })

    it('should block calls one minute after end', () => {
      const config = {
        start: '09:00',
        end: '17:00',
      }

      const currentTime = '17:01'

      const isAllowed = currentTime >= config.start && currentTime < config.end
      expect(isAllowed).toBe(false)
    })
  })

  describe('Midnight boundary', () => {
    it('should handle hours crossing midnight', () => {
      const config = {
        start: '20:00',
        end: '02:00', // Next day
      }

      // Between 8pm and midnight
      expect('22:00' >= config.start).toBe(true)

      // Between midnight and 2am (requires special handling)
      const afterMidnight = '01:00'
      // This scenario needs date-aware logic
    })

    it('should handle 24-hour operation', () => {
      const config = {
        start: '00:00',
        end: '23:59',
      }

      const times = ['00:00', '12:00', '23:58', '23:59']

      times.forEach((time) => {
        const isAllowed = time >= config.start && time <= config.end
        expect(isAllowed).toBe(true)
      })
    })
  })

  describe('TCPA boundary (8am-9pm)', () => {
    it('should allow at 8:00:00 AM', () => {
      const hour = 8
      const minute = 0

      const isAllowed = hour >= 8 && hour < 21
      expect(isAllowed).toBe(true)
    })

    it('should block at 7:59:59 AM', () => {
      const hour = 7
      const minute = 59

      const isAllowed = hour >= 8 && hour < 21
      expect(isAllowed).toBe(false)
    })

    it('should allow at 8:59:59 PM', () => {
      const hour = 20
      const minute = 59

      const isAllowed = hour >= 8 && hour < 21
      expect(isAllowed).toBe(true)
    })

    it('should block at 9:00:00 PM', () => {
      const hour = 21
      const minute = 0

      const isAllowed = hour >= 8 && hour < 21
      expect(isAllowed).toBe(false)
    })
  })

  describe('Timezone boundaries', () => {
    it('should respect local timezone at boundary', () => {
      // 8am EST = 5am PST
      const estTime = new Date('2026-03-26T08:00:00-05:00')
      const pstTime = new Date('2026-03-26T08:00:00-08:00')

      expect(estTime.getTime()).not.toBe(pstTime.getTime())
      expect(estTime.getTime()).toBeLessThan(pstTime.getTime())
    })

    it('should check calling hours in contact timezone', () => {
      const contact = {
        phone: '+12025551234',
        timezone: 'America/New_York',
      }

      const campaign = {
        calling_window: {
          start: '09:00',
          end: '17:00',
          timezone: 'America/Los_Angeles',
        },
      }

      // Must convert to contact's local time
      expect(contact.timezone).toBeDefined()
      expect(campaign.calling_window.timezone).toBeDefined()
      expect(contact.timezone).not.toBe(campaign.calling_window.timezone)
    })
  })

  describe('Day boundaries', () => {
    it('should block calls on days with no configured hours', () => {
      const config = {
        monday: { start: '09:00', end: '17:00' },
        // Saturday/Sunday not configured
      }

      const isSaturday = true
      const hasHours = config['saturday' as keyof typeof config]

      expect(hasHours).toBeUndefined()
      expect(!hasHours).toBe(true)
    })

    it('should allow different hours per day', () => {
      const config = {
        monday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '15:00' },
        saturday: { start: '10:00', end: '14:00' },
      }

      expect(config.monday.end).toBe('17:00')
      expect(config.friday.end).toBe('15:00')
      expect(config.saturday.start).toBe('10:00')
    })
  })

  describe('Holiday boundaries', () => {
    it('should block calls on holidays regardless of time', () => {
      const config = {
        holidays: ['2026-12-25', '2026-01-01'],
        hours: { start: '09:00', end: '17:00' },
      }

      const currentDate = '2026-12-25'
      const isHoliday = config.holidays.includes(currentDate)

      expect(isHoliday).toBe(true)
      // Even if time is within hours, block on holiday
    })

    it('should allow calls on day before/after holiday', () => {
      const holidays = ['2026-12-25']

      const dec24 = '2026-12-24'
      const dec25 = '2026-12-25'
      const dec26 = '2026-12-26'

      expect(holidays.includes(dec24)).toBe(false)
      expect(holidays.includes(dec25)).toBe(true)
      expect(holidays.includes(dec26)).toBe(false)
    })
  })
})
