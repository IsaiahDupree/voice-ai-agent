// F1306: Test contact lookup failure handling

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import {
  lookupContactWithFallback,
  lookupContactByIdWithFallback,
  clearContactCache,
  getContactCacheStats,
} from '@/lib/contact-lookup'

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}))

const { supabaseAdmin } = require('@/lib/supabase')

describe('F1306: Contact lookup failure handling', () => {
  beforeEach(() => {
    clearContactCache()
    jest.clearAllMocks()
  })

  it('should return contact from database on successful lookup', async () => {
    const mockContact = {
      id: 1,
      phone: '+1234567890',
      name: 'John Doe',
      email: 'john@example.com',
    }

    const mockSingle = jest.fn().mockResolvedValue({
      data: mockContact,
      error: null,
    })

    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
    })

    const result = await lookupContactWithFallback('+1234567890')

    expect(result.success).toBe(true)
    expect(result.source).toBe('database')
    expect(result.contact).toEqual(mockContact)
    expect(mockSingle).toHaveBeenCalled()
  })

  it('should return partial contact when database lookup fails', async () => {
    const mockSingle = jest.fn().mockRejectedValue(new Error('Database connection failed'))

    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
    })

    const result = await lookupContactWithFallback('+1234567890')

    expect(result.success).toBe(true)
    expect(result.source).toBe('partial')
    expect(result.contact.phone).toBe('+1234567890')
    expect(result.contact.name).toBe('Unknown Contact')
    expect(result.contact.metadata.partial).toBe(true)
    // Should retry 3 times (initial + 2 retries)
    expect(mockSingle).toHaveBeenCalledTimes(3)
  })

  it('should use cache on database failure if available', async () => {
    const mockContact = {
      id: 1,
      phone: '+1234567890',
      name: 'John Doe',
    }

    // First call - successful database lookup
    const mockSingle1 = jest.fn().mockResolvedValue({
      data: mockContact,
      error: null,
    })

    supabaseAdmin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: mockSingle1,
        }),
      }),
    })

    await lookupContactWithFallback('+1234567890')

    // Second call - database fails, should use cache
    const mockSingle2 = jest.fn().mockRejectedValue(new Error('Database down'))

    supabaseAdmin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: mockSingle2,
        }),
      }),
    })

    const result = await lookupContactWithFallback('+1234567890')

    expect(result.success).toBe(true)
    expect(result.source).toBe('cache')
    expect(result.contact).toEqual(mockContact)
  })

  it('should cache successful lookups', async () => {
    const mockContact = {
      id: 1,
      phone: '+1234567890',
      name: 'John Doe',
    }

    const mockSingle = jest.fn().mockResolvedValue({
      data: mockContact,
      error: null,
    })

    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
    })

    await lookupContactWithFallback('+1234567890')

    const stats = getContactCacheStats()
    expect(stats.size).toBe(1)
    expect(stats.entries[0].key).toBe('+1234567890')
  })

  it('should return partial contact when not found and no errors', async () => {
    const mockSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' }, // Not found
    })

    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
    })

    const result = await lookupContactWithFallback('+1234567890')

    expect(result.success).toBe(true)
    expect(result.source).toBe('partial')
    expect(result.contact.phone).toBe('+1234567890')
  })

  it('should handle contact lookup by ID with fallback', async () => {
    const mockContact = {
      id: 123,
      phone: '+1234567890',
      name: 'John Doe',
    }

    const mockSingle = jest.fn().mockResolvedValue({
      data: mockContact,
      error: null,
    })

    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
    })

    const result = await lookupContactByIdWithFallback(123)

    expect(result.success).toBe(true)
    expect(result.source).toBe('database')
    expect(result.contact.id).toBe(123)
  })

  it('should return error when ID lookup fails with no cache', async () => {
    const mockSingle = jest.fn().mockRejectedValue(new Error('Not found'))

    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
    })

    const result = await lookupContactByIdWithFallback(999)

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })
})
