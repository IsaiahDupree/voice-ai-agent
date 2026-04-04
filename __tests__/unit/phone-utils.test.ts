// F1203: Unit test: E.164 validation

import { isValidE164, normalizePhone, formatPhoneDisplay } from '@/lib/phone-utils'

describe('Phone Utils - E.164 Validation', () => {
  describe('isValidE164', () => {
    it('should accept valid E.164 numbers', () => {
      expect(isValidE164('+12025551234')).toBe(true)
      expect(isValidE164('+442071234567')).toBe(true)
      expect(isValidE164('+33123456789')).toBe(true)
      expect(isValidE164('+61412345678')).toBe(true)
      expect(isValidE164('+15555555555')).toBe(true)
    })

    it('should reject invalid E.164 numbers', () => {
      // Missing + prefix
      expect(isValidE164('12025551234')).toBe(false)

      // Leading zero in country code
      expect(isValidE164('+02025551234')).toBe(false)

      // Too short (just country code, no subscriber number)
      expect(isValidE164('+1')).toBe(false)

      // Too long (more than 15 digits)
      expect(isValidE164('+1234567890123456')).toBe(false)

      // Contains non-digits
      expect(isValidE164('+1-202-555-1234')).toBe(false)
      expect(isValidE164('+1 (202) 555-1234')).toBe(false)

      // Empty or invalid
      expect(isValidE164('')).toBe(false)
      expect(isValidE164('invalid')).toBe(false)
      expect(isValidE164('+abc')).toBe(false)
    })
  })

  describe('normalizePhone', () => {
    it('should normalize US/Canada 10-digit numbers to E.164', () => {
      expect(normalizePhone('2025551234')).toBe('+12025551234')
      expect(normalizePhone('4155551234')).toBe('+14155551234')
    })

    it('should normalize US/Canada 11-digit numbers to E.164', () => {
      expect(normalizePhone('12025551234')).toBe('+12025551234')
      expect(normalizePhone('14155551234')).toBe('+14155551234')
    })

    it('should handle numbers with formatting characters', () => {
      expect(normalizePhone('(202) 555-1234')).toBe('+12025551234')
      expect(normalizePhone('202-555-1234')).toBe('+12025551234')
      expect(normalizePhone('1-202-555-1234')).toBe('+12025551234')
      expect(normalizePhone('+1 (202) 555-1234')).toBe('+12025551234')
    })

    it('should preserve international numbers', () => {
      expect(normalizePhone('+442071234567')).toBe('+442071234567')
      expect(normalizePhone('+33123456789')).toBe('+33123456789')
      expect(normalizePhone('442071234567')).toBe('+442071234567')
    })
  })

  describe('formatPhoneDisplay', () => {
    it('should format US/Canada numbers for display', () => {
      expect(formatPhoneDisplay('+12025551234')).toBe('(202) 555-1234')
      expect(formatPhoneDisplay('12025551234')).toBe('(202) 555-1234')
      expect(formatPhoneDisplay('2025551234')).toBe('(202) 555-1234')
    })

    it('should return original format for non-US numbers', () => {
      expect(formatPhoneDisplay('+442071234567')).toBe('+442071234567')
      expect(formatPhoneDisplay('+33123456789')).toBe('+33123456789')
    })

    it('should handle empty input', () => {
      expect(formatPhoneDisplay('')).toBe('')
    })
  })
})
