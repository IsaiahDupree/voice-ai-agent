// F0855: Analytics caching - cache expensive analytics queries

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // milliseconds
}

class AnalyticsCache {
  private cache: Map<string, CacheEntry<any>> = new Map()

  /**
   * F0855: Get cached value or compute if expired
   */
  async get<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttl: number = 300000 // 5 minutes default
  ): Promise<T> {
    const entry = this.cache.get(key)

    // Return cached if valid
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      console.log(`✓ Analytics cache hit: ${key}`)
      return entry.data as T
    }

    // Compute new value
    console.log(`⟳ Analytics cache miss: ${key}, computing...`)
    const data = await computeFn()

    // Store in cache
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })

    return data
  }

  /**
   * F0855: Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key)
    console.log(`✗ Analytics cache invalidated: ${key}`)
  }

  /**
   * F0855: Invalidate all cache entries matching pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern)
    let count = 0

    for (const key of Array.from(this.cache.keys())) {
      if (regex.test(key)) {
        this.cache.delete(key)
        count++
      }
    }

    console.log(`✗ Analytics cache invalidated: ${count} entries matching "${pattern}"`)
  }

  /**
   * F0855: Clear entire cache
   */
  clear(): void {
    const size = this.cache.size
    this.cache.clear()
    console.log(`✗ Analytics cache cleared: ${size} entries removed`)
  }

  /**
   * F0855: Get cache stats
   */
  stats(): {
    size: number
    entries: Array<{ key: string; age_ms: number; ttl_ms: number }>
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age_ms: Date.now() - entry.timestamp,
      ttl_ms: entry.ttl,
    }))

    return {
      size: this.cache.size,
      entries,
    }
  }

  /**
   * F0855: Build cache key from params
   */
  buildKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&')

    return `${prefix}:${sortedParams}`
  }
}

// Singleton instance
export const analyticsCache = new AnalyticsCache()

/**
 * F0855: Helper to wrap analytics query with caching
 */
export async function cachedAnalyticsQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  return analyticsCache.get(cacheKey, queryFn, ttl)
}
