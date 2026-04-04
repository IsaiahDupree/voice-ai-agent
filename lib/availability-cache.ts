// F0329: Availability cache with invalidation

import { CalComSlot } from './calcom'

interface CacheEntry {
  data: CalComSlot[]
  timestamp: number
  eventTypeId: number
  date: string
}

class AvailabilityCache {
  private cache: Map<string, CacheEntry> = new Map()
  private ttl: number = 5 * 60 * 1000 // 5 minutes default TTL

  /**
   * Generate cache key from eventTypeId and date
   */
  private getCacheKey(eventTypeId: number, date: string): string {
    return `${eventTypeId}:${date}`
  }

  /**
   * Get availability from cache if valid
   */
  get(eventTypeId: number, date: string): CalComSlot[] | null {
    const key = this.getCacheKey(eventTypeId, date)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if cache entry is still valid
    const age = Date.now() - entry.timestamp
    if (age > this.ttl) {
      this.cache.delete(key)
      return null
    }

    console.log(`[Cache HIT] Availability for event ${eventTypeId} on ${date}`)
    return entry.data
  }

  /**
   * Set availability in cache
   */
  set(eventTypeId: number, date: string, data: CalComSlot[]): void {
    const key = this.getCacheKey(eventTypeId, date)
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      eventTypeId,
      date
    })
    console.log(`[Cache SET] Availability for event ${eventTypeId} on ${date}`)
  }

  /**
   * F0329: Invalidate cache for a specific event type and date
   * Called after a new booking is created
   */
  invalidate(eventTypeId: number, date: string): void {
    const key = this.getCacheKey(eventTypeId, date)
    const deleted = this.cache.delete(key)
    if (deleted) {
      console.log(`[Cache INVALIDATE] Cleared availability for event ${eventTypeId} on ${date}`)
    }
  }

  /**
   * F0329: Invalidate all cache entries for an event type
   * Useful when event type settings change
   */
  invalidateEventType(eventTypeId: number): void {
    let count = 0
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.eventTypeId === eventTypeId) {
        this.cache.delete(key)
        count++
      }
    }
    if (count > 0) {
      console.log(`[Cache INVALIDATE] Cleared ${count} entries for event ${eventTypeId}`)
    }
  }

  /**
   * F0329: Invalidate all cached availability
   */
  invalidateAll(): void {
    const size = this.cache.size
    this.cache.clear()
    if (size > 0) {
      console.log(`[Cache INVALIDATE] Cleared all ${size} cache entries`)
    }
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; entries: Array<{ key: string; age: number }> } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Math.floor((Date.now() - entry.timestamp) / 1000) // seconds
    }))

    return {
      size: this.cache.size,
      entries
    }
  }

  /**
   * Set TTL for cache entries (in milliseconds)
   */
  setTTL(ttlMs: number): void {
    this.ttl = ttlMs
  }
}

// Singleton instance
export const availabilityCache = new AvailabilityCache()
