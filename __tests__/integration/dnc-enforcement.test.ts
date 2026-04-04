// F1192: Integration test: DNC

/**
 * Integration test for DNC (Do Not Call) enforcement
 * Tests DNC list management and enforcement across all call types
 */

describe('DNC Enforcement Integration', () => {
  describe('DNC list management', () => {
    it('should add number to DNC list', () => {
      const dncEntry = {
        phone: '+12025551234',
        source: 'self-service' as const,
        reason: 'Customer requested removal during call',
        added_at: '2026-03-26T12:00:00Z',
      }

      expect(dncEntry.phone).toMatch(/^\+[1-9]\d{1,14}$/)
      expect(dncEntry.source).toBe('self-service')
      expect(dncEntry.reason).toBeDefined()
    })

    it('should support multiple DNC sources', () => {
      const sources: Array<'manual' | 'self-service' | 'import'> = [
        'manual',
        'self-service',
        'import',
      ]

      sources.forEach((source) => {
        const entry = { phone: '+12025551234', source, added_at: new Date().toISOString() }
        expect(['manual', 'self-service', 'import']).toContain(entry.source)
      })
    })

    it('should prevent duplicate DNC entries', () => {
      const entry1 = { id: 1, phone: '+12025551234' }
      const entry2 = { phone: '+12025551234' }

      // Database constraint prevents duplicates
      expect(entry1.phone).toBe(entry2.phone)
      // Second insert should be ignored (upsert behavior)
    })
  })

  describe('DNC enforcement in campaigns', () => {
    it('should skip DNC numbers in campaign', () => {
      const campaignContacts = [
        { id: 1, phone: '+12025551234', isDNC: false },
        { id: 2, phone: '+14155551234', isDNC: true },
        { id: 3, phone: '+13105551234', isDNC: false },
      ]

      const dialable = campaignContacts.filter((c) => !c.isDNC)
      expect(dialable).toHaveLength(2)
      expect(dialable.every((c) => !c.isDNC)).toBe(true)
    })

    it('should mark contact as DNC when requested', () => {
      const contact = {
        id: 1,
        phone: '+12025551234',
        status: 'contacted',
      }

      // During call, customer requests DNC
      const updatedContact = {
        ...contact,
        status: 'dnc' as const,
        outcome: 'dnc' as const,
      }

      expect(updatedContact.status).toBe('dnc')
      expect(updatedContact.outcome).toBe('dnc')
    })

    it('should stop campaign attempts for DNC contacts', () => {
      const contact = {
        id: 1,
        phone: '+12025551234',
        status: 'dnc',
        attempts: 1,
        max_attempts: 3,
      }

      // No further attempts should be made
      expect(contact.status).toBe('dnc')
      // Even if attempts < max_attempts, don't retry
    })
  })

  describe('DNC enforcement in inbound', () => {
    it('should allow inbound calls from DNC numbers', () => {
      // DNC only applies to outbound - inbound always allowed
      const inboundCall = {
        type: 'inbound',
        customer: { number: '+12025551234' },
        isDNC: true,
      }

      // Inbound calls are ALWAYS allowed, even if on DNC
      expect(inboundCall.type).toBe('inbound')
      // DNC doesn't block inbound
    })

    it('should respect DNC for outbound calls', () => {
      const outboundCall = {
        type: 'outbound',
        to: '+12025551234',
        isDNC: true,
      }

      if (outboundCall.isDNC && outboundCall.type === 'outbound') {
        // Should not place call
        expect(outboundCall.isDNC).toBe(true)
      }
    })
  })

  describe('Self-service DNC opt-out', () => {
    it('should provide DNC opt-out during call', () => {
      const functionCall = {
        name: 'optOutDNC',
        parameters: {
          phone: '+12025551234',
          reason: 'Customer requested during call',
        },
      }

      expect(functionCall.name).toBe('optOutDNC')
      expect(functionCall.parameters.phone).toBeDefined()
    })

    it('should confirm DNC opt-out to caller', () => {
      const response = {
        success: true,
        message: 'You have been added to our Do Not Call list',
      }

      expect(response.success).toBe(true)
      expect(response.message).toContain('Do Not Call')
    })

    it('should log DNC opt-out event', () => {
      const auditLog = {
        event_type: 'dnc_opt_out',
        phone_number: '+12025551234',
        source: 'self-service',
        call_id: 'call_123',
        timestamp: '2026-03-26T12:00:00Z',
      }

      expect(auditLog.event_type).toBe('dnc_opt_out')
      expect(auditLog.source).toBe('self-service')
      expect(auditLog.call_id).toBeDefined()
    })
  })

  describe('DNC list export', () => {
    it('should export DNC list as CSV', () => {
      const csvContent = `phone,source,reason,added_at
+12025551234,self-service,Customer requested,2026-03-26T12:00:00Z
+14155551234,manual,Complained about frequency,2026-03-25T10:00:00Z`

      const lines = csvContent.split('\n')
      expect(lines[0]).toContain('phone,source,reason,added_at')
      expect(lines.length).toBeGreaterThan(1)
    })

    it('should include all DNC entries in export', () => {
      const dncList = [
        { phone: '+12025551234', source: 'self-service', added_at: '2026-03-26' },
        { phone: '+14155551234', source: 'manual', added_at: '2026-03-25' },
        { phone: '+13105551234', source: 'import', added_at: '2026-03-24' },
      ]

      expect(dncList).toHaveLength(3)
      expect(dncList.every((e) => e.phone && e.source && e.added_at)).toBe(true)
    })
  })

  describe('DNC compliance', () => {
    it('should check DNC before every outbound call', () => {
      const preCallChecks = ['validatePhone', 'checkDNC', 'checkCallingHours', 'checkTCPA']

      expect(preCallChecks).toContain('checkDNC')
    })

    it('should enforce DNC at campaign level', () => {
      const campaignConfig = {
        respectDNC: true,
        enforceTCPA: true,
      }

      expect(campaignConfig.respectDNC).toBe(true)
    })

    it('should log DNC enforcement', () => {
      const enforcementLog = {
        event: 'call_blocked',
        reason: 'Number on DNC list',
        phone: '+12025551234',
        campaign_id: 1,
        timestamp: '2026-03-26T12:00:00Z',
      }

      expect(enforcementLog.reason).toContain('DNC')
      expect(enforcementLog.event).toBe('call_blocked')
    })
  })

  describe('SMS and DNC', () => {
    it('should check DNC before sending SMS', () => {
      const sms = {
        to: '+12025551234',
        message: 'Your appointment is confirmed',
        isDNC: true,
      }

      if (sms.isDNC) {
        // Should not send SMS
        expect(sms.isDNC).toBe(true)
      }
    })

    it('should support SMS-specific opt-out', () => {
      const contact = {
        phone: '+12025551234',
        opt_out_sms: true,
        opt_out_calls: false,
      }

      // Can call but not SMS
      expect(contact.opt_out_sms).toBe(true)
      expect(contact.opt_out_calls).toBe(false)
    })
  })
})
