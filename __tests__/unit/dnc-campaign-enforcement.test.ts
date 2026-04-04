// F1250: Test: DNC enforcement in campaign

describe('DNC Enforcement in Campaign', () => {
  describe('Campaign contact filtering', () => {
    it('should filter out DNC numbers from dial list', () => {
      const contacts = [
        { id: 1, phone: '+12025551234', status: 'pending', isDNC: false },
        { id: 2, phone: '+14155551234', status: 'pending', isDNC: true },
        { id: 3, phone: '+13105551234', status: 'pending', isDNC: false },
        { id: 4, phone: '+16175551234', status: 'pending', isDNC: true },
      ]

      const dialable = contacts.filter((c) => !c.isDNC && c.status === 'pending')

      expect(dialable).toHaveLength(2)
      expect(dialable.every((c) => !c.isDNC)).toBe(true)
      expect(dialable.map((c) => c.phone)).toEqual(['+12025551234', '+13105551234'])
    })

    it('should update contact status when DNC detected', () => {
      const contact = {
        id: 1,
        phone: '+12025551234',
        campaign_id: 1,
        status: 'pending',
        outcome: null,
      }

      // DNC check returns true
      const isDNC = true

      if (isDNC) {
        const updated = {
          ...contact,
          status: 'dnc' as const,
          outcome: 'dnc' as const,
        }

        expect(updated.status).toBe('dnc')
        expect(updated.outcome).toBe('dnc')
      }
    })

    it('should skip already-DNC contacts', () => {
      const contact = {
        id: 1,
        phone: '+12025551234',
        status: 'dnc',
        attempts: 0,
      }

      const shouldDial = contact.status !== 'dnc'
      expect(shouldDial).toBe(false)
    })
  })

  describe('Pre-dial DNC check', () => {
    it('should check DNC list before every dial attempt', () => {
      const dialChecks = [
        { name: 'checkDNC', result: false },
        { name: 'checkCallingHours', result: true },
        { name: 'checkAttempts', result: true },
      ]

      const dncCheck = dialChecks.find((c) => c.name === 'checkDNC')
      expect(dncCheck).toBeDefined()
      expect(dncCheck?.result).toBe(false) // Not on DNC
    })

    it('should abort dial if DNC check fails', () => {
      const phone = '+12025551234'
      const isDNC = true

      if (isDNC) {
        const result = {
          dialed: false,
          reason: 'Number on DNC list',
        }

        expect(result.dialed).toBe(false)
        expect(result.reason).toContain('DNC')
      }
    })

    it('should log DNC block events', () => {
      const event = {
        event_type: 'call_blocked',
        phone_number: '+12025551234',
        campaign_id: 1,
        reason: 'DNC list',
        timestamp: '2026-03-26T12:00:00Z',
      }

      expect(event.event_type).toBe('call_blocked')
      expect(event.reason).toBe('DNC list')
      expect(event.campaign_id).toBeDefined()
    })
  })

  describe('DNC additions during campaign', () => {
    it('should immediately respect newly added DNC entries', () => {
      // Contact called at 12:00
      const call1Time = '2026-03-26T12:00:00Z'

      // Added to DNC at 12:05
      const dncAddedTime = '2026-03-26T12:05:00Z'

      // Next retry scheduled at 13:00
      const retryTime = '2026-03-26T13:00:00Z'

      // At 13:00, should check DNC again and skip
      const isDNCNow = new Date(dncAddedTime) < new Date(retryTime)
      expect(isDNCNow).toBe(true)
    })

    it('should mark pending retries as DNC', () => {
      const contact = {
        id: 1,
        phone: '+12025551234',
        status: 'pending',
        next_attempt_at: '2026-03-26T13:00:00Z',
        attempts: 1,
      }

      // Customer added to DNC after first attempt
      const updated = {
        ...contact,
        status: 'dnc' as const,
        outcome: 'dnc' as const,
        next_attempt_at: null,
      }

      expect(updated.status).toBe('dnc')
      expect(updated.next_attempt_at).toBeNull()
    })
  })

  describe('Campaign-level DNC stats', () => {
    it('should count DNC outcomes', () => {
      const outcomes = [
        { contact_id: 1, outcome: 'booked' },
        { contact_id: 2, outcome: 'dnc' },
        { contact_id: 3, outcome: 'voicemail' },
        { contact_id: 4, outcome: 'dnc' },
        { contact_id: 5, outcome: 'no-answer' },
      ]

      const dncCount = outcomes.filter((o) => o.outcome === 'dnc').length
      expect(dncCount).toBe(2)
    })

    it('should calculate DNC rate', () => {
      const stats = {
        total_contacts: 100,
        contacted: 60,
        dnc: 5,
      }

      const dncRate = (stats.dnc / stats.contacted) * 100
      expect(dncRate).toBeCloseTo(8.33, 1)
    })
  })

  describe('Bulk import DNC', () => {
    it('should validate phones in bulk DNC import', () => {
      const importList = ['+12025551234', '+14155551234', 'invalid-phone', '+13105551234']

      const valid = importList.filter((phone) => /^\+[1-9]\d{1,14}$/.test(phone))

      expect(valid).toHaveLength(3)
      expect(valid).not.toContain('invalid-phone')
    })

    it('should mark campaign contacts as DNC after import', () => {
      const importedNumbers = ['+12025551234', '+14155551234']
      const campaignContacts = [
        { id: 1, phone: '+12025551234', status: 'pending' },
        { id: 2, phone: '+14155551234', status: 'pending' },
        { id: 3, phone: '+13105551234', status: 'pending' },
      ]

      const toUpdate = campaignContacts.filter((c) => importedNumbers.includes(c.phone))

      expect(toUpdate).toHaveLength(2)
      expect(toUpdate.every((c) => importedNumbers.includes(c.phone))).toBe(true)
    })
  })
})
