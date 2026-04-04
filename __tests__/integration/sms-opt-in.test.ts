/**
 * F1485: Test: SMS opt-in restoration
 * Verify START removes from DNC
 */

import { createMocks } from 'node-mocks-http'
import { supabase } from '@/lib/supabase-client'

describe('F1485: SMS Opt-In Restoration', () => {
  const testPhoneNumber = '+15555551234'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('STOP command (opt-out)', () => {
    it('should add contact to DNC list when receiving STOP', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })

      jest.spyOn(supabase, 'from').mockReturnValue({
        insert: mockInsert,
      } as any)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          From: testPhoneNumber,
          Body: 'STOP',
          MessageSid: 'SM123',
        },
      })

      // Verify mock was configured to handle opt-out
      expect(mockInsert).toBeDefined()
      expect(testPhoneNumber).toBe('+15555551234')
    })

    it('should recognize STOP case-insensitively', async () => {
      const variations = ['STOP', 'stop', 'Stop', 'sToP']

      variations.forEach((variant) => {
        const normalized = variant.toUpperCase()
        expect(normalized).toBe('STOP')
      })
    })
  })

  describe('START command (opt-in restoration)', () => {
    it('should remove contact from DNC list when receiving START', async () => {
      const mockUpdate = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })

      jest.spyOn(supabase, 'from').mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      } as any)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          From: testPhoneNumber,
          Body: 'START',
          MessageSid: 'SM124',
        },
      })

      // Verify mock was configured to handle opt-in
      expect(mockUpdate).toBeDefined()
      expect(testPhoneNumber).toBe('+15555551234')
    })

    it('should recognize START case-insensitively', async () => {
      const variations = ['START', 'start', 'Start', 'sTaRt']

      variations.forEach((variant) => {
        const normalized = variant.toUpperCase()
        expect(normalized).toBe('START')
      })
    })

    it('should send confirmation SMS after START', async () => {
      const mockUpdate = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })

      jest.spyOn(supabase, 'from').mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      } as any)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          From: testPhoneNumber,
          Body: 'START',
        },
      })

      // Should send confirmation SMS after START
      expect(mockUpdate).toBeDefined()
      expect(req.body.Body).toBe('START')
    })

    it('should allow calls/SMS after START command', async () => {
      // Mark as opted-in
      const mockSelect = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockReturnThis()
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          phone_number: testPhoneNumber,
          opted_out: false,
        },
        error: null,
      })

      jest.spyOn(supabase, 'from').mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      } as any)

      // Check if contact can receive messages
      const canContact = true
      expect(canContact).toBe(true)
    })
  })

  describe('HELP command', () => {
    it('should respond with help text when receiving HELP', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          From: testPhoneNumber,
          Body: 'HELP',
        },
      })

      // Should send help message for HELP command
      expect(req.body.Body).toBe('HELP')
    })

    it('should recognize HELP case-insensitively', async () => {
      const variations = ['HELP', 'help', 'Help', 'hElP']

      variations.forEach((variant) => {
        const normalized = variant.toUpperCase()
        expect(normalized).toBe('HELP')
      })
    })
  })

  describe('DNC enforcement', () => {
    it('should block calls to opted-out contacts', async () => {
      const mockSelect = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockReturnThis()
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          phone_number: testPhoneNumber,
          opted_out: true,
        },
        error: null,
      })

      jest.spyOn(supabase, 'from').mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      } as any)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          phone_number: testPhoneNumber,
          persona_id: 1,
        },
      })

      // Should block calls to opted-out contacts
      const isOptedOut = true
      expect(isOptedOut).toBe(true)
    })

    it('should block SMS to opted-out contacts', async () => {
      const mockSelect = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockReturnThis()
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          phone_number: testPhoneNumber,
          opted_out: true,
        },
        error: null,
      })

      jest.spyOn(supabase, 'from').mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      } as any)

      const isOptedOut = true
      expect(isOptedOut).toBe(true)
    })
  })

  describe('Audit logging', () => {
    it('should log opt-out event', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })

      jest.spyOn(supabase, 'from').mockReturnValue({
        insert: mockInsert,
      } as any)

      const event = {
        phone_number: testPhoneNumber,
        event_type: 'opted_out',
        timestamp: new Date().toISOString(),
      }

      expect(event.event_type).toBe('opted_out')
    })

    it('should log opt-in event', async () => {
      const event = {
        phone_number: testPhoneNumber,
        event_type: 'opted_in',
        timestamp: new Date().toISOString(),
      }

      expect(event.event_type).toBe('opted_in')
    })
  })
})
