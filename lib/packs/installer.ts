/**
 * Pack installer.
 *
 * Materializes a tenant_pack_installs row from a pack template + tenant
 * KB values + integration map. Validates kb_values against the pack's
 * kb_schema and ensures every required_integration is mapped before
 * activation.
 *
 * State machine:
 *   draft     — created, KB partial, integrations missing
 *   active    — KB validated, all required integrations mapped
 *   suspended — admin-paused (kept for upgrades)
 *   archived  — uninstalled
 */

import { supabaseAdmin } from '../supabase'
import { invalidatePackContextCache } from './context'
import { materializePersona } from './persona'

export interface KbField {
  type: 'string' | 'string[]' | 'number' | 'boolean' | 'phone' | 'email' | 'weekly_schedule' | 'json'
  required?: boolean
  description?: string
  enum?: string[]
}

export interface KbSchema {
  [field: string]: KbField
}

export interface IndustryPackRow {
  id: string
  slug: string
  name: string
  version: string
  kb_schema: KbSchema
  required_integrations: string[]
  optional_integrations: string[]
  tool_subset: string[]
  default_voice_profile?: Record<string, unknown>
  compliance_profiles?: {
    slug?: string
    required_disclosures?: string[]
    blocked_phrases?: string[]
    flags?: Record<string, unknown>
  }
}

export interface InstallInput {
  tenantId: string
  packSlug: string
  kbValues: Record<string, unknown>
  integrationMap: Record<string, string>
  activate?: boolean
}

export interface InstallResult {
  installId: string
  status: 'draft' | 'active' | 'suspended' | 'archived'
  validationErrors: string[]
  assistantId?: string | null
}

export class PackInstallError extends Error {
  constructor(message: string, public readonly errors: string[] = []) {
    super(message)
    this.name = 'PackInstallError'
  }
}

export async function installPack(input: InstallInput): Promise<InstallResult> {
  const pack = await fetchPackBySlug(input.packSlug)
  if (!pack) throw new PackInstallError(`Unknown pack: ${input.packSlug}`)

  const validationErrors = validateKbValues(pack.kb_schema, input.kbValues)
  const integrationErrors = validateIntegrations(
    pack.required_integrations,
    input.integrationMap,
  )
  const allErrors = [...validationErrors, ...integrationErrors]

  const wantActivate = input.activate !== false
  const canActivate = allErrors.length === 0 && wantActivate
  const status = canActivate ? 'active' : 'draft'
  const now = new Date().toISOString()

  const upsertRow = {
    tenant_id: input.tenantId,
    pack_id: pack.id,
    pack_version: pack.version,
    kb_values: input.kbValues,
    integration_map: input.integrationMap,
    status,
    activated_at: status === 'active' ? now : null,
    updated_at: now,
  }

  const { data, error } = await supabaseAdmin
    .from('tenant_pack_installs')
    .upsert(upsertRow, { onConflict: 'tenant_id,pack_id' })
    .select('id, status')
    .single()

  if (error) throw new PackInstallError(`Install failed: ${error.message}`)

  invalidatePackContextCache()

  const installId = (data as any).id as string
  let assistantId: string | null = null

  // Materialize a Vapi assistant only on activation. Best-effort: a
  // failure to provision the assistant must not roll back the install.
  if ((data as any).status === 'active') {
    try {
      assistantId = await materializePersona({
        installId,
        tenantId: input.tenantId,
        packSlug: pack.slug,
        packName: pack.name,
        toolSubset: pack.tool_subset ?? [],
        voiceProfile: (pack.default_voice_profile as any) ?? {},
        compliance: pack.compliance_profiles ?? {},
        kbValues: input.kbValues,
      })
    } catch (e) {
      console.error('[packs] materialization failed:', e)
    }
  }

  return {
    installId,
    status: (data as any).status,
    validationErrors: allErrors,
    assistantId,
  }
}

export async function uninstallPack(tenantId: string, packSlug: string): Promise<void> {
  const pack = await fetchPackBySlug(packSlug)
  if (!pack) throw new PackInstallError(`Unknown pack: ${packSlug}`)

  const { error } = await supabaseAdmin
    .from('tenant_pack_installs')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('pack_id', pack.id)

  if (error) throw new PackInstallError(`Uninstall failed: ${error.message}`)
  invalidatePackContextCache()
}

export async function listAvailablePacks(): Promise<IndustryPackRow[]> {
  const { data, error } = await supabaseAdmin
    .from('industry_packs')
    .select('id, slug, name, version, kb_schema, required_integrations, optional_integrations, tool_subset, status')
    .eq('status', 'published')
    .order('name')
  if (error) return []
  return (data ?? []) as IndustryPackRow[]
}

export async function listTenantInstalls(tenantId: string): Promise<unknown[]> {
  const { data, error } = await supabaseAdmin
    .from('tenant_pack_installs')
    .select('id, pack_id, pack_version, status, kb_values, integration_map, installed_at, activated_at, industry_packs:pack_id (slug, name)')
    .eq('tenant_id', tenantId)
    .neq('status', 'archived')
  if (error) return []
  return data ?? []
}

async function fetchPackBySlug(slug: string): Promise<IndustryPackRow | null> {
  const { data, error } = await supabaseAdmin
    .from('industry_packs')
    .select(
      'id, slug, name, version, kb_schema, required_integrations, optional_integrations, tool_subset, default_voice_profile, compliance_profiles:compliance_profile_id (slug, required_disclosures, blocked_phrases, flags)',
    )
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data) return null
  return data as IndustryPackRow
}

export function validateKbValues(
  schema: KbSchema,
  values: Record<string, unknown>,
): string[] {
  const errors: string[] = []
  for (const [field, spec] of Object.entries(schema)) {
    const v = values[field]
    if (v === undefined || v === null || v === '') {
      if (spec.required) errors.push(`Missing required KB field: ${field}`)
      continue
    }
    if (!matchesType(v, spec.type)) {
      errors.push(`KB field "${field}" expected ${spec.type}, got ${typeof v}`)
    }
    if (spec.enum && !spec.enum.includes(String(v))) {
      errors.push(`KB field "${field}" must be one of: ${spec.enum.join(', ')}`)
    }
  }
  return errors
}

function matchesType(v: unknown, type: KbField['type']): boolean {
  switch (type) {
    case 'string':
    case 'phone':
    case 'email':
      return typeof v === 'string'
    case 'string[]':
      return Array.isArray(v) && v.every(x => typeof x === 'string')
    case 'number':
      return typeof v === 'number'
    case 'boolean':
      return typeof v === 'boolean'
    case 'weekly_schedule':
    case 'json':
      return typeof v === 'object' && v !== null
    default:
      return true
  }
}

export function validateIntegrations(
  required: string[],
  map: Record<string, string>,
): string[] {
  const errors: string[] = []
  for (const key of required) {
    if (!map[key]) errors.push(`Missing integration mapping: ${key}`)
  }
  return errors
}
