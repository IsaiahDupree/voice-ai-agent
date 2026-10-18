/**
 * Pack execution context.
 *
 * Resolves the active tenant_pack_install for a call so tool runtime
 * can read kb_values, integration_map, and tool_subset without each
 * call site touching the database.
 *
 * Lookup precedence:
 *   1. callMetadata.pack_install_id (explicit, highest signal)
 *   2. callMetadata.tenant_id + active install
 *   3. tenant resolved from to_number → tenant_phone_numbers (future)
 */

import { supabaseAdmin } from '../supabase'
import type { IntegrationMap } from '../providers/registry'

export interface PackContext {
  tenantId: string
  packId: string
  packSlug: string
  packVersion: string
  installId: string
  kbValues: Record<string, unknown>
  integrationMap: IntegrationMap
  toolSubset: string[]
  complianceProfileSlug?: string
}

interface ResolveOpts {
  tenantId?: string
  packInstallId?: string
  packSlug?: string
}

const cache = new Map<string, { ctx: PackContext; expiresAt: number }>()
const CACHE_TTL_MS = 60_000

export async function resolvePackContext(opts: ResolveOpts): Promise<PackContext | null> {
  const cacheKey = JSON.stringify(opts)
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.ctx

  let query = supabaseAdmin
    .from('tenant_pack_installs')
    .select(
      'id, tenant_id, pack_id, pack_version, kb_values, integration_map, status, ' +
        'industry_packs:pack_id (slug, tool_subset, compliance_profiles:compliance_profile_id (slug))',
    )
    .eq('status', 'active')
    .limit(1)

  if (opts.packInstallId) {
    query = query.eq('id', opts.packInstallId)
  } else if (opts.tenantId && opts.packSlug) {
    // Filter by joined slug — supabase-js v2 supports nested filters with !inner
    query = query.eq('tenant_id', opts.tenantId)
    // we'll filter on slug client-side after fetch
  } else if (opts.tenantId) {
    query = query.eq('tenant_id', opts.tenantId)
  } else {
    return null
  }

  const { data, error } = await query.maybeSingle()
  if (error || !data) return null

  const pack = (data as any).industry_packs ?? {}
  const compliance = pack.compliance_profiles ?? {}

  if (opts.packSlug && pack.slug !== opts.packSlug) return null

  const ctx: PackContext = {
    tenantId: (data as any).tenant_id,
    packId: (data as any).pack_id,
    packSlug: pack.slug,
    packVersion: (data as any).pack_version,
    installId: (data as any).id,
    kbValues: (data as any).kb_values ?? {},
    integrationMap: ((data as any).integration_map ?? {}) as IntegrationMap,
    toolSubset: (pack.tool_subset ?? []) as string[],
    complianceProfileSlug: compliance.slug,
  }

  cache.set(cacheKey, { ctx, expiresAt: Date.now() + CACHE_TTL_MS })
  return ctx
}

export function invalidatePackContextCache(): void {
  cache.clear()
}

export function isToolAllowed(ctx: PackContext | null, toolName: string): boolean {
  if (!ctx || ctx.toolSubset.length === 0) return true // no restriction
  return ctx.toolSubset.includes(toolName)
}
