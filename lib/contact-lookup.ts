// F1306: Contact lookup failure handling with caching and fallback
import { supabaseAdmin } from './supabase'
import { withRetry } from './api-error-handler'

// Simple in-memory cache for contact lookups
const contactCache = new Map<string, { contact: any; cachedAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export interface ContactLookupResult {
  success: boolean
  contact?: any
  source: 'database' | 'cache' | 'partial'
  error?: string
}

/**
 * F1306: Lookup contact with failure handling
 *
 * Priority:
 * 1. Try database lookup with retry
 * 2. Fall back to cache if available
 * 3. Return partial data (phone number only) as last resort
 */
export async function lookupContactWithFallback(
  phoneNumber: string
): Promise<ContactLookupResult> {
  const cacheKey = phoneNumber

  try {
    // Try database lookup with retry for transient failures
    const { data: contact, error } = await withRetry(
      async () => {
        const result = await supabaseAdmin
          .from('voice_agent_contacts')
          .select('*')
          .eq('phone', phoneNumber)
          .single()

        // PGRST116 = not found (expected, not an error to retry)
        if (result.error && result.error.code !== 'PGRST116') {
          throw result.error
        }

        return result
      },
      {
        maxRetries: 2,
        retryDelayMs: 100,
        logError: true,
      }
    )

    if (contact) {
      // Update cache with successful lookup
      contactCache.set(cacheKey, {
        contact,
        cachedAt: Date.now(),
      })

      return {
        success: true,
        contact,
        source: 'database',
      }
    }

    // Contact not found in database - return partial data
    return {
      success: true,
      contact: createPartialContact(phoneNumber),
      source: 'partial',
    }
  } catch (error: any) {
    console.warn('[Contact Lookup] Database lookup failed, trying fallback:', error.message)

    // F1306: Try cache fallback
    const cached = contactCache.get(cacheKey)
    if (cached) {
      const age = Date.now() - cached.cachedAt

      // Use cache even if stale during outage
      if (age < CACHE_TTL_MS || isInDatabaseOutage(error)) {
        console.log(`[Contact Lookup] Using cached contact (age: ${Math.round(age / 1000)}s)`)

        return {
          success: true,
          contact: cached.contact,
          source: 'cache',
        }
      }
    }

    // F1306: Last resort - return partial contact with just phone number
    console.warn('[Contact Lookup] No cache available, returning partial contact')

    return {
      success: true,
      contact: createPartialContact(phoneNumber),
      source: 'partial',
      error: 'Database unavailable, using partial data',
    }
  }
}

/**
 * Create partial contact with minimal data when database is unavailable
 */
function createPartialContact(phoneNumber: string): any {
  return {
    id: null,
    phone: phoneNumber,
    name: 'Unknown Contact',
    email: null,
    company: null,
    deal_stage: 'lead',
    notes: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      partial: true,
      reason: 'Database lookup failed',
    },
  }
}

/**
 * Check if error indicates a database outage (vs. not found)
 */
function isInDatabaseOutage(error: any): boolean {
  const message = error.message?.toLowerCase() || ''
  const code = error.code || ''

  return (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('unavailable') ||
    error.status >= 500
  )
}

/**
 * Lookup contact by ID with fallback
 */
export async function lookupContactByIdWithFallback(
  contactId: number
): Promise<ContactLookupResult> {
  const cacheKey = `id:${contactId}`

  try {
    const { data: contact, error } = await withRetry(
      async () => {
        const result = await supabaseAdmin
          .from('voice_agent_contacts')
          .select('*')
          .eq('id', contactId)
          .single()

        if (result.error) throw result.error
        return result
      },
      {
        maxRetries: 2,
        retryDelayMs: 100,
        logError: true,
      }
    )

    // Update cache
    contactCache.set(cacheKey, {
      contact,
      cachedAt: Date.now(),
    })

    return {
      success: true,
      contact,
      source: 'database',
    }
  } catch (error: any) {
    console.warn('[Contact Lookup] Database lookup failed for ID:', contactId, error.message)

    // Try cache
    const cached = contactCache.get(cacheKey)
    if (cached) {
      const age = Date.now() - cached.cachedAt

      if (age < CACHE_TTL_MS || isInDatabaseOutage(error)) {
        console.log(`[Contact Lookup] Using cached contact (age: ${Math.round(age / 1000)}s)`)

        return {
          success: true,
          contact: cached.contact,
          source: 'cache',
        }
      }
    }

    // No cache available
    return {
      success: false,
      source: 'cache',
      error: `Contact ${contactId} not found and no cache available`,
    }
  }
}

/**
 * Clear expired cache entries (call periodically)
 */
export function cleanContactCache(): void {
  const now = Date.now()
  let cleaned = 0

  for (const [key, value] of Array.from(contactCache.entries())) {
    if (now - value.cachedAt > CACHE_TTL_MS) {
      contactCache.delete(key)
      cleaned++
    }
  }

  if (cleaned > 0) {
    console.log(`[Contact Cache] Cleaned ${cleaned} expired entries`)
  }
}

/**
 * Clear entire cache (for testing)
 */
export function clearContactCache(): void {
  contactCache.clear()
}

/**
 * Get cache stats
 */
export function getContactCacheStats(): {
  size: number
  entries: Array<{ key: string; age: number }>
} {
  const now = Date.now()
  const entries = Array.from(contactCache.entries()).map(([key, value]) => ({
    key,
    age: Math.round((now - value.cachedAt) / 1000),
  }))

  return {
    size: contactCache.size,
    entries,
  }
}
