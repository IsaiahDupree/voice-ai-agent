// F1306: Simple unit tests for contact lookup failure handling logic

import { describe, it, expect } from '@jest/globals'
import {
  clearContactCache,
  getContactCacheStats,
} from '@/lib/contact-lookup'

describe('F1306: Contact lookup cache', () => {
  it('should start with empty cache', () => {
    clearContactCache()
    const stats = getContactCacheStats()
    expect(stats.size).toBe(0)
    expect(stats.entries.length).toBe(0)
  })

  it('should clear cache', () => {
    clearContactCache()
    const stats = getContactCacheStats()
    expect(stats.size).toBe(0)
  })

  it('should provide cache stats', () => {
    clearContactCache()
    const stats = getContactCacheStats()
    expect(stats).toHaveProperty('size')
    expect(stats).toHaveProperty('entries')
    expect(Array.isArray(stats.entries)).toBe(true)
  })
})
