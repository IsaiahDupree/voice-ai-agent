// F1133: API key authentication - Support API key auth as alternative to JWT
// F1134: API key hashing - Store API key hash, not plaintext

import crypto from 'crypto'
import { supabaseAdmin } from './supabase'

/**
 * F1134: Hash API key using SHA-256 for secure storage
 * Store only the hash, never the plaintext key
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Generate a new API key with format: vaa_<random>
 * vaa = voice-ai-agent
 */
export function generateApiKey(): string {
  const random = crypto.randomBytes(24).toString('hex')
  return `vaa_${random}`
}

/**
 * F1133: Authenticate using API key
 * Verifies the provided API key against stored hashes
 *
 * @returns User/app data if valid, null if invalid
 */
export async function authenticateApiKey(
  apiKey: string
): Promise<{
  id: string
  name: string
  owner: string
  status: string
  scopes: string[]
} | null> {
  try {
    if (!apiKey) return null

    // Hash the provided key
    const keyHash = hashApiKey(apiKey)

    // Look up in database
    const { data: key, error } = await supabaseAdmin
      .from('voice_agent_api_keys')
      .select('id, name, owner, status, scopes')
      .eq('key_hash', keyHash)
      .single()

    if (error || !key) {
      console.warn('[API Auth] Invalid API key provided')
      return null
    }

    // Check if key is active
    if (key.status !== 'active') {
      console.warn('[API Auth] API key is not active:', key.id)
      return null
    }

    // Update last used timestamp
    await supabaseAdmin
      .from('voice_agent_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', key.id)
      .single()

    return key
  } catch (error: any) {
    console.error('[API Auth] Error authenticating API key:', error)
    return null
  }
}

/**
 * Create a new API key for an application
 */
export async function createApiKey(params: {
  name: string
  owner: string
  scopes?: string[]
  expiresAt?: Date
}): Promise<{
  id: string
  key: string // Only returned once
  keyHash: string
} | null> {
  try {
    const key = generateApiKey()
    const keyHash = hashApiKey(key)

    const { data, error } = await supabaseAdmin
      .from('voice_agent_api_keys')
      .insert({
        key_hash: keyHash,
        name: params.name,
        owner: params.owner,
        scopes: params.scopes || [],
        status: 'active',
        expires_at: params.expiresAt?.toISOString() || null,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !data) {
      throw error || new Error('Failed to create API key')
    }

    return {
      id: data.id,
      key, // Only returned once at creation
      keyHash,
    }
  } catch (error: any) {
    console.error('[API Keys] Error creating API key:', error)
    return null
  }
}

/**
 * Revoke an API key by marking it as revoked
 */
export async function revokeApiKey(keyId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('voice_agent_api_keys')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', keyId)

    if (error) {
      throw error
    }

    return true
  } catch (error: any) {
    console.error('[API Keys] Error revoking API key:', error)
    return false
  }
}

/**
 * List API keys for an owner (without exposing the key itself)
 */
export async function listApiKeys(owner: string): Promise<any[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_api_keys')
      .select('id, name, status, scopes, created_at, last_used_at, expires_at')
      .eq('owner', owner)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return data || []
  } catch (error: any) {
    console.error('[API Keys] Error listing API keys:', error)
    return []
  }
}

/**
 * Extract API key from request headers
 * Supports: Authorization: Bearer vaa_xxx or X-API-Key: vaa_xxx
 */
export function extractApiKeyFromRequest(authHeader?: string, apiKeyHeader?: string): string | null {
  // Check X-API-Key header first
  if (apiKeyHeader) {
    return apiKeyHeader
  }

  // Check Authorization Bearer token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}
