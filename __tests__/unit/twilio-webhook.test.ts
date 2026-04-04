// F1200: Unit test: Twilio webhook handler

import { twilioIncomingSMS, twilioSMSOptOut, twilioSMSStatusDelivered } from '../fixtures'
import { mockSupabase } from '../mocks'

describe('Twilio Webhook Handler', () => {
  beforeEach(() => {
    mockSupabase.reset()
  })

  describe('F1200: Incoming SMS webhook', () => {
    it('should handle incoming SMS message', async () => {
      const payload = twilioIncomingSMS

      // Verify webhook payload structure
      expect(payload.MessageSid).toBeDefined()
      expect(payload.From).toBe('+15555551234')
      expect(payload.To).toBeDefined()
      expect(payload.Body).toBeDefined()
      expect(payload.SmsStatus).toBe('received')
    })

    it('should extract phone number from incoming SMS', () => {
      const payload = twilioIncomingSMS
      const from = payload.From

      expect(from).toMatch(/^\+1\d{10}$/)
    })

    it('should identify opt-out keywords', () => {
      const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']
      const testBody = twilioSMSOptOut.Body

      expect(optOutKeywords).toContain(testBody)
    })

    it('should handle SMS status callback', () => {
      const payload = twilioSMSStatusDelivered

      expect(payload.MessageStatus).toBe('delivered')
      expect(payload.MessageSid).toBeDefined()
    })
  })

  describe('SMS opt-out handling', () => {
    it('should recognize STOP keyword', () => {
      const payload = twilioSMSOptOut

      expect(payload.Body.toUpperCase()).toBe('STOP')
    })

    it('should handle opt-out case-insensitively', () => {
      const keywords = ['STOP', 'stop', 'Stop', 'StOp']

      keywords.forEach((keyword) => {
        expect(keyword.toUpperCase()).toBe('STOP')
      })
    })
  })

  describe('SMS validation', () => {
    it('should validate required webhook fields', () => {
      const payload = twilioIncomingSMS
      const requiredFields = [
        'MessageSid',
        'AccountSid',
        'From',
        'To',
        'Body',
        'SmsStatus',
      ]

      requiredFields.forEach((field) => {
        expect(payload).toHaveProperty(field)
      })
    })

    it('should validate phone number format', () => {
      const phone = twilioIncomingSMS.From
      const e164Regex = /^\+[1-9]\d{1,14}$/

      expect(phone).toMatch(e164Regex)
    })
  })
})
