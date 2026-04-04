/**
 * Multi-Tenant Router
 * Resolves tenant context from incoming phone numbers and provides tenant-scoped query helpers
 */

import { supabaseAdmin } from './supabase'

export interface Tenant {
  id: string
  name: string
  slug: string
  phone_numbers: string[]
  plan: 'free' | 'starter' | 'pro' | 'enterprise'
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

export interface TenantConfig {
  id: number
  tenant_id: string
  kb_namespace: string
  assistant_id: string | null
  persona_name: string | null
  voice_id: string | null
  system_prompt: string | null
  timezone: string
  business_hours: Record<string, { open: string; close: string }>
  created_at: string
  updated_at: string
}

export interface TenantContext {
  tenant: Tenant
  config: TenantConfig
}

/**
 * Feature 126: Resolve tenant from incoming phone number
 *
 * Looks up which tenant owns the given phone number.
 * Returns 'default' tenant if no match found.
 *
 * @param phoneNumber - E.164 format phone number (e.g., +15551234567)
 * @returns Tenant object or null if not found
 */
export async function resolveTenantFromPhoneNumber(
  phoneNumber: string
): Promise<Tenant | null> {
  try {
    // Normalize phone number (remove spaces, dashes, etc.)
    const normalized = phoneNumber.replace(/[\s\-\(\)]/g, '')

    // Query tenants table where phone_numbers array contains this number
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .contains('phone_numbers', [normalized])
      .single()

    if (error) {
      // If no match, return default tenant
      if (error.code === 'PGRST116') {
        return getDefaultTenant()
      }
      console.error('Error resolving tenant from phone number:', error)
      return null
    }

    return data as Tenant
  } catch (error) {
    console.error('Exception in resolveTenantFromPhoneNumber:', error)
    return null
  }
}

/**
 * Get the default tenant (fallback)
 */
async function getDefaultTenant(): Promise<Tenant | null> {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('id', 'default')
    .single()

  if (error) {
    console.error('Error fetching default tenant:', error)
    return null
  }

  return data as Tenant
}

/**
 * Feature 127: Load tenant assistant config
 *
 * Retrieves the full tenant configuration including assistant ID, persona, voice, etc.
 *
 * @param tenantId - Tenant ID
 * @returns TenantConfig object or null if not found
 */
export async function loadTenantConfig(
  tenantId: string
): Promise<TenantConfig | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      console.error('Error loading tenant config:', error)
      return null
    }

    return data as TenantConfig
  } catch (error) {
    console.error('Exception in loadTenantConfig:', error)
    return null
  }
}

/**
 * Get full tenant context (tenant + config) from phone number
 *
 * @param phoneNumber - Incoming phone number
 * @returns Complete tenant context or null
 */
export async function getTenantContext(
  phoneNumber: string
): Promise<TenantContext | null> {
  const tenant = await resolveTenantFromPhoneNumber(phoneNumber)
  if (!tenant) {
    return null
  }

  const config = await loadTenantConfig(tenant.id)
  if (!config) {
    return null
  }

  return { tenant, config }
}

/**
 * Feature 128: Scope KB, memory, DNC to tenant_id
 *
 * Helper class to build tenant-scoped queries
 */
export class TenantQueryBuilder {
  constructor(private tenantId: string) {}

  /**
   * Scope KB documents query to this tenant
   */
  scopeKbDocuments() {
    return supabaseAdmin
      .from('kb_documents')
      .select('*')
      .eq('tenant_id', this.tenantId)
  }

  /**
   * Scope KB embeddings query to this tenant
   */
  scopeKbEmbeddings() {
    return supabaseAdmin
      .from('kb_embeddings')
      .select('*')
      .eq('tenant_id', this.tenantId)
  }

  /**
   * Scope caller memory query to this tenant
   */
  scopeCallerMemory() {
    return supabaseAdmin
      .from('caller_memory')
      .select('*')
      .eq('tenant_id', this.tenantId)
  }

  /**
   * Scope DNC list query to this tenant
   */
  scopeDncList() {
    return supabaseAdmin
      .from('dnc_list')
      .select('*')
      .eq('tenant_id', this.tenantId)
  }

  /**
   * Scope call logs query to this tenant
   */
  scopeCallLogs() {
    return supabaseAdmin
      .from('call_logs')
      .select('*')
      .eq('tenant_id', this.tenantId)
  }

  /**
   * Scope contacts query to this tenant
   */
  scopeContacts() {
    return supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('tenant_id', this.tenantId)
  }

  /**
   * Scope campaigns query to this tenant
   */
  scopeCampaigns() {
    return supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('tenant_id', this.tenantId)
  }

  /**
   * Generic scope method for any table
   */
  scope(tableName: string) {
    return supabaseAdmin
      .from(tableName)
      .select('*')
      .eq('tenant_id', this.tenantId)
  }
}

/**
 * Create a tenant-scoped query builder
 *
 * @param tenantId - Tenant ID
 * @returns TenantQueryBuilder instance
 */
export function createTenantQueryBuilder(tenantId: string): TenantQueryBuilder {
  return new TenantQueryBuilder(tenantId)
}

/**
 * Validate that a tenant exists and is active
 *
 * @param tenantId - Tenant ID to validate
 * @returns boolean indicating if tenant is valid
 */
export async function validateTenant(tenantId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .single()

    return !error && !!data
  } catch (error) {
    console.error('Exception in validateTenant:', error)
    return false
  }
}

/**
 * List all tenants (admin function)
 *
 * @returns Array of all tenants
 */
export async function listAllTenants(): Promise<Tenant[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error listing tenants:', error)
      return []
    }

    return data as Tenant[]
  } catch (error) {
    console.error('Exception in listAllTenants:', error)
    return []
  }
}

/**
 * Get tenant by slug
 *
 * @param slug - Tenant slug (e.g., 'acme-corp')
 * @returns Tenant or null
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) {
      console.error('Error fetching tenant by slug:', error)
      return null
    }

    return data as Tenant
  } catch (error) {
    console.error('Exception in getTenantBySlug:', error)
    return null
  }
}

/**
 * Get tenant by ID
 *
 * @param tenantId - Tenant ID
 * @returns Tenant or null
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (error) {
      console.error('Error fetching tenant by ID:', error)
      return null
    }

    return data as Tenant
  } catch (error) {
    console.error('Exception in getTenantById:', error)
    return null
  }
}
