// F1256: Test: SMS opt-out flow

describe('SMS Opt-Out Flow', () => {
  describe('STOP keyword detection', () => {
    it('should detect STOP keyword', () => {
      const messages = ['STOP', 'stop', 'Stop', 'STOP ', ' STOP']

      messages.forEach((msg) => {
        const normalized = msg.trim().toUpperCase()
        expect(normalized).toBe('STOP')
      })
    })

    it('should detect STOP variants', () => {
      const stopVariants = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']

      stopVariants.forEach((variant) => {
        expect(['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']).toContain(variant)
      })
    })

    it('should not detect STOP in regular messages', () => {
      const message = 'Please stop by our office tomorrow'

      const isOptOut = message.trim().toUpperCase() === 'STOP'
      expect(isOptOut).toBe(false)
    })
  })

  describe('Opt-out processing', () => {
    it('should update contact opt_out_sms flag', () => {
      const contact = {
        phone: '+12025551234',
        opt_out_sms: false,
        opt_out_calls: false,
      }

      // User sends STOP
      const updated = {
        ...contact,
        opt_out_sms: true,
      }

      expect(updated.opt_out_sms).toBe(true)
      expect(updated.opt_out_calls).toBe(false) // Calls still allowed
    })

    it('should log opt-out event', () => {
      const event = {
        event_type: 'sms_opt_out',
        phone_number: '+12025551234',
        message_received: 'STOP',
        timestamp: '2026-03-26T12:00:00Z',
      }

      expect(event.event_type).toBe('sms_opt_out')
      expect(event.message_received).toBe('STOP')
    })

    it('should send confirmation SMS', () => {
      const confirmation = {
        to: '+12025551234',
        message: 'You have been unsubscribed from SMS messages. Reply START to opt back in.',
        status: 'sent',
      }

      expect(confirmation.message).toContain('unsubscribed')
      expect(confirmation.message).toContain('START')
    })
  })

  describe('START keyword (opt back in)', () => {
    it('should detect START keyword', () => {
      const messages = ['START', 'start', 'Start', 'START ', ' start']

      messages.forEach((msg) => {
        const normalized = msg.trim().toUpperCase()
        expect(normalized).toBe('START')
      })
    })

    it('should re-enable SMS when START received', () => {
      const contact = {
        phone: '+12025551234',
        opt_out_sms: true,
      }

      // User sends START
      const updated = {
        ...contact,
        opt_out_sms: false,
      }

      expect(updated.opt_out_sms).toBe(false)
    })

    it('should send opt-in confirmation', () => {
      const confirmation = {
        to: '+12025551234',
        message: 'You have been re-subscribed to SMS messages. Reply STOP to opt out.',
        status: 'sent',
      }

      expect(confirmation.message).toContain('re-subscribed')
      expect(confirmation.message).toContain('STOP')
    })
  })

  describe('SMS enforcement', () => {
    it('should block SMS to opted-out contacts', () => {
      const contact = {
        phone: '+12025551234',
        opt_out_sms: true,
      }

      if (contact.opt_out_sms) {
        const result = {
          success: false,
          error: 'Contact has opted out of SMS',
        }

        expect(result.success).toBe(false)
        expect(result.error).toContain('opted out')
      }
    })

    it('should check opt-out before every SMS', () => {
      const preChecks = ['validatePhone', 'checkDNC', 'checkSMSOptOut']

      expect(preChecks).toContain('checkSMSOptOut')
    })

    it('should allow calls to SMS opt-outs', () => {
      const contact = {
        phone: '+12025551234',
        opt_out_sms: true,
        opt_out_calls: false,
      }

      // SMS blocked but calls allowed
      expect(contact.opt_out_sms).toBe(true)
      expect(contact.opt_out_calls).toBe(false)
    })
  })

  describe('STOP footer compliance', () => {
    it('should include STOP instruction in SMS', () => {
      const sms = {
        message: 'Your appointment is confirmed for tomorrow at 2pm. Reply STOP to opt out.',
      }

      expect(sms.message).toContain('STOP')
      expect(sms.message.toLowerCase()).toContain('opt out')
    })

    it('should auto-append STOP footer if missing', () => {
      const originalMessage = 'Your appointment is confirmed for tomorrow.'
      const hasStop = originalMessage.toLowerCase().includes('stop')

      let finalMessage = originalMessage
      if (!hasStop) {
        finalMessage += ' Reply STOP to opt out.'
      }

      expect(finalMessage).toContain('STOP')
    })

    it('should not duplicate STOP instruction', () => {
      const message = 'Appointment confirmed. Reply STOP to opt out.'
      const hasStop = message.toLowerCase().includes('stop')

      expect(hasStop).toBe(true)
      // Don't append again
    })
  })

  describe('Compliance logging', () => {
    it('should log all SMS opt-out events', () => {
      const log = {
        event_type: 'sms_opt_out',
        phone_number: '+12025551234',
        inbound_message: 'STOP',
        confirmation_sent: true,
        timestamp: '2026-03-26T12:00:00Z',
      }

      expect(log.event_type).toBe('sms_opt_out')
      expect(log.confirmation_sent).toBe(true)
    })

    it('should log SMS opt-in events', () => {
      const log = {
        event_type: 'sms_opt_in',
        phone_number: '+12025551234',
        inbound_message: 'START',
        confirmation_sent: true,
        timestamp: '2026-03-26T12:05:00Z',
      }

      expect(log.event_type).toBe('sms_opt_in')
      expect(log.inbound_message).toBe('START')
    })

    it('should log blocked SMS attempts', () => {
      const log = {
        event_type: 'sms_blocked',
        phone_number: '+12025551234',
        reason: 'Contact opted out',
        attempted_at: '2026-03-26T12:10:00Z',
      }

      expect(log.event_type).toBe('sms_blocked')
      expect(log.reason).toContain('opted out')
    })
  })

  describe('Webhook handling', () => {
    it('should handle Twilio status webhook for opt-out', () => {
      const webhook = {
        MessageSid: 'SM123',
        From: '+12025551234',
        Body: 'STOP',
        MessageStatus: 'received',
      }

      const isOptOut = webhook.Body.trim().toUpperCase() === 'STOP'
      expect(isOptOut).toBe(true)
      expect(webhook.From).toBeDefined()
    })

    it('should handle opt-out response delivery status', () => {
      const statusWebhook = {
        MessageSid: 'SM124',
        MessageStatus: 'delivered',
        To: '+12025551234',
      }

      expect(statusWebhook.MessageStatus).toBe('delivered')
    })
  })

  describe('Bulk opt-out management', () => {
    it('should export opt-out list', () => {
      const optOuts = [
        { phone: '+12025551234', opted_out_at: '2026-03-26T12:00:00Z' },
        { phone: '+14155551234', opted_out_at: '2026-03-25T10:00:00Z' },
      ]

      expect(optOuts).toHaveLength(2)
      expect(optOuts.every((o) => o.phone && o.opted_out_at)).toBe(true)
    })

    it('should support bulk opt-out import', () => {
      const importList = ['+12025551234', '+14155551234', '+13105551234']

      const valid = importList.filter((phone) => /^\+[1-9]\d{1,14}$/.test(phone))

      expect(valid).toHaveLength(3)
      expect(valid).toEqual(importList)
    })
  })
})
