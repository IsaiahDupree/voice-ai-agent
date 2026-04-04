// F0309: Calendar availability cache - cache availability responses for 60s

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class CalendarAvailabilityCache {
  private cache: Map<string, CacheEntry<any>>
  private readonly DEFAULT_TTL = 60 * 1000 // 60 seconds

  constructor() {
    this.cache = new Map()
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  /**
   * Build a cache key from parameters
   */
  buildKey(params: {
    eventTypeId?: string
    startDate?: string
    endDate?: string
    userId?: string
  }): string {
    const parts = [
      params.eventTypeId || 'all',
      params.startDate || 'today',
      params.endDate || 'future',
      params.userId || 'default',
    ]
    return parts.join(':')
  }

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    const now = Date.now()
    const age = now - entry.timestamp

    if (age > entry.ttl) {
      // Expired, remove from cache
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cached data with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
    })
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const keys = Array.from(this.cache.keys())
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    })
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    const keys = Array.from(this.cache.keys())

    keys.forEach((key) => {
      const entry = this.cache.get(key)
      if (entry && now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    })
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    hitRate: number
    totalHits: number
    totalMisses: number
  } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
      totalHits: 0,
      totalMisses: 0,
    }
  }
}

// Singleton instance
export const calendarCache = new CalendarAvailabilityCache()

/**
 * Cached function wrapper for calendar availability queries
 */
export async function cachedAvailabilityQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache first
  const cached = calendarCache.get<T>(cacheKey)

  if (cached !== null) {
    return cached
  }

  // Execute query
  const result = await queryFn()

  // Cache the result
  calendarCache.set(cacheKey, result, ttl)

  return result
}
