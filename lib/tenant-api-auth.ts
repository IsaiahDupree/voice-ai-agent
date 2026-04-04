/**
 * Feature 137: Tenant API Key Authentication
 * Validates x-tenant-api-key header and returns tenant context
 */

import crypto from 'crypto'
import { supabaseAdmin } from './supabase'
import { NextRequest } from 'next/server'

export interface TenantApiKey {
  id: string
  tenant_id: string
  name: string
  key_hash: string
  status: 'active' | 'revoked'
  scopes: string[]
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
}

export interface TenantAuthResult {
  tenant_id: string
  tenant_name: string
  tenant_slug: string
  api_key_id: string
  scopes: string[]
}

/**
 * Hash API key using SHA-256
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Generate a new tenant API key with format: vaa_tenant_<tenant_slug>_<random>
 */
export function generateTenantApiKey(tenantSlug: string): string {
  const random = crypto.randomBytes(20).toString('hex')
  return `vaa_tenant_${tenantSlug}_${random}`
}

/**
 * Authenticate request using x-tenant-api-key header
 *
 * @param request - Next.js request object
 * @returns Tenant auth result or null if invalid
 */
export async function authenticateTenantApiKey(
  request: NextRequest
): Promise<TenantAuthResult | null> {
  try {
    // Extract API key from header
    const apiKey = request.headers.get('x-tenant-api-key')

    if (!apiKey) {
      return null
    }

    // Hash the provided key
    const keyHash = hashApiKey(apiKey)

    // Look up API key with tenant info
    const { data: apiKeyData, error } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('*, tenants(id, name, slug)')
      .eq('key_hash', keyHash)
      .eq('status', 'active')
      .single()

    if (error || !apiKeyData) {
      console.warn('[Tenant API Auth] Invalid API key provided')
      return null
    }

    // Check if key has expired
    if (apiKeyData.expires_at) {
      const expiresAt = new Date(apiKeyData.expires_at)
      if (expiresAt < new Date()) {
        console.warn('[Tenant API Auth] API key has expired:', apiKeyData.id)
        return null
      }
    }

    // Update last used timestamp
    await supabaseAdmin
      .from('tenant_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyData.id)

    const tenant = apiKeyData.tenants as any

    return {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      tenant_slug: tenant.slug,
      api_key_id: apiKeyData.id,
      scopes: apiKeyData.scopes || [],
    }
  } catch (error: any) {
    console.error('[Tenant API Auth] Error authenticating:', error)
    return null
  }
}

/**
 * Create a new API key for a tenant
 *
 * @param tenantId - Tenant ID
 * @param name - API key name/description
 * @param scopes - Permission scopes (e.g., ['calls:read', 'contacts:write'])
 * @param expiresAt - Optional expiration date
 * @returns API key data (key is only returned once)
 */
export async function createTenantApiKey(params: {
  tenantId: string
  name: string
  scopes?: string[]
  expiresAt?: Date
}): Promise<{
  id: string
  key: string // Only returned once
  keyHash: string
} | null> {
  try {
    // Get tenant slug
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('slug')
      .eq('id', params.tenantId)
      .single()

    if (tenantError || !tenant) {
      console.error('[Tenant API Auth] Tenant not found:', params.tenantId)
      return null
    }

    // Generate key
    const key = generateTenantApiKey(tenant.slug)
    const keyHash = hashApiKey(key)

    // Store in database
    const { data, error } = await supabaseAdmin
      .from('tenant_api_keys')
      .insert({
        tenant_id: params.tenantId,
        name: params.name,
        key_hash: keyHash,
        scopes: params.scopes || [],
        status: 'active',
        expires_at: params.expiresAt?.toISOString() || null,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[Tenant API Auth] Error creating API key:', error)
      return null
    }

    return {
      id: data.id,
      key, // Only returned once at creation
      keyHash,
    }
  } catch (error: any) {
    console.error('[Tenant API Auth] Error creating API key:', error)
    return null
  }
}

/**
 * Revoke a tenant API key
 */
export async function revokeTenantApiKey(
  keyId: string,
  tenantId: string
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('tenant_api_keys')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('id', keyId)
      .eq('tenant_id', tenantId)

    if (error) {
      console.error('[Tenant API Auth] Error revoking API key:', error)
      return false
    }

    return true
  } catch (error: any) {
    console.error('[Tenant API Auth] Error revoking API key:', error)
    return false
  }
}

/**
 * List all API keys for a tenant (without exposing the key itself)
 */
export async function listTenantApiKeys(tenantId: string): Promise<any[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('id, name, status, scopes, created_at, last_used_at, expires_at, revoked_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Tenant API Auth] Error listing API keys:', error)
      return []
    }

    return data || []
  } catch (error: any) {
    console.error('[Tenant API Auth] Error listing API keys:', error)
    return []
  }
}

/**
 * Middleware helper: Check if API key has required scope
 */
export function hasScope(authResult: TenantAuthResult, requiredScope: string): boolean {
  return authResult.scopes.includes(requiredScope) || authResult.scopes.includes('*')
}

/**
 * Middleware helper: Extract tenant ID from authenticated request
 */
export function getTenantId(authResult: TenantAuthResult | null): string {
  return authResult?.tenant_id || 'default'
}
