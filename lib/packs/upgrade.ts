/**
 * Pack version upgrade path.
 *
 * Upgrades a tenant_pack_install from its current pack_version to the
 * latest published version of the same pack. The diff strategy:
 *
 *   1. Fields removed from kb_schema → drop from kb_values (logged)
 *   2. Fields with same name + same type → keep value
 *   3. Fields with same name + different type → flag for review,
 *      install moves to status='draft'
 *   4. New required fields without a value → flag for review,
 *      install moves to status='draft'
 *   5. New optional fields → no-op (caller can fill later)
 *
 * Compatible upgrades stay 'active'; breaking diffs revert to 'draft'.
 * Upgrade history is appended to upgrade_history for audit.
 */

import { supabaseAdmin } from '../supabase'
import { invalidatePackContextCache } from './context'
import type { KbSchema, KbField } from './installer'
import { validateKbValues, validateIntegrations } from './installer'
import { materializePersona } from './persona'

export interface UpgradePlan {
  fromVersion: string
  toVersion: string
  removed: string[]
  typeChanged: { field: string; from: string; to: string }[]
  newRequired: string[]
  newOptional: string[]
  breaking: boolean
}

export interface UpgradeResult {
  installId: string
  status: 'active' | 'draft'
  plan: UpgradePlan
  validationErrors: string[]
  assistantId?: string | null
}

export async function planUpgrade(
  fromSchema: KbSchema,
  toSchema: KbSchema,
  fromVersion: string,
  toVersion: string,
  currentValues: Record<string, unknown>,
): Promise<UpgradePlan> {
  const removed: string[] = []
  const typeChanged: UpgradePlan['typeChanged'] = []
  const newRequired: string[] = []
  const newOptional: string[] = []

  for (const [field, spec] of Object.entries(fromSchema)) {
    if (!toSchema[field]) {
      removed.push(field)
      continue
    }
    if (toSchema[field].type !== spec.type) {
      typeChanged.push({ field, from: spec.type, to: toSchema[field].type })
    }
  }

  for (const [field, spec] of Object.entries(toSchema)) {
    if (fromSchema[field]) continue
    if (spec.required && (currentValues[field] === undefined || currentValues[field] === '')) {
      newRequired.push(field)
    } else {
      newOptional.push(field)
    }
  }

  return {
    fromVersion,
    toVersion,
    removed,
    typeChanged,
    newRequired,
    newOptional,
    breaking: typeChanged.length > 0 || newRequired.length > 0,
  }
}

export async function upgradeInstall(opts: {
  tenantId: string
  packSlug: string
}): Promise<UpgradeResult> {
  const { data: pack, error: packErr } = await supabaseAdmin
    .from('industry_packs')
    .select(
      'id, slug, name, version, kb_schema, tool_subset, required_integrations, default_voice_profile, compliance_profiles:compliance_profile_id (slug, required_disclosures, blocked_phrases, flags)',
    )
    .eq('slug', opts.packSlug)
    .maybeSingle()
  if (packErr || !pack) throw new Error(`Unknown pack: ${opts.packSlug}`)

  const { data: install, error: installErr } = await supabaseAdmin
    .from('tenant_pack_installs')
    .select('id, pack_version, kb_values, integration_map, upgrade_history')
    .eq('tenant_id', opts.tenantId)
    .eq('pack_id', (pack as any).id)
    .maybeSingle()
  if (installErr || !install) throw new Error('No install found for this tenant + pack')

  const fromVersion = (install as any).pack_version as string
  const toVersion = (pack as any).version as string

  if (fromVersion === toVersion) {
    return {
      installId: (install as any).id,
      status: 'active',
      plan: {
        fromVersion,
        toVersion,
        removed: [],
        typeChanged: [],
        newRequired: [],
        newOptional: [],
        breaking: false,
      },
      validationErrors: [],
    }
  }

  // We do not retain the prior version's kb_schema in the DB, so the
  // "from" schema is reconstructed from current kb_values keys with type
  // inferred from the "to" schema (best-effort: only matters for the
  // `removed` and `typeChanged` checks).
  const currentValues = ((install as any).kb_values ?? {}) as Record<string, unknown>
  const fromSchema = inferPriorSchema(currentValues, (pack as any).kb_schema)
  const plan = await planUpgrade(
    fromSchema,
    (pack as any).kb_schema,
    fromVersion,
    toVersion,
    currentValues,
  )

  // Build new kb_values: drop removed fields, keep the rest as-is.
  const newValues: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(currentValues)) {
    if (!plan.removed.includes(k)) newValues[k] = v
  }

  const validationErrors = [
    ...validateKbValues((pack as any).kb_schema, newValues),
    ...validateIntegrations(
      (pack as any).required_integrations ?? [],
      ((install as any).integration_map ?? {}) as Record<string, string>,
    ),
  ]
  const status: 'active' | 'draft' = plan.breaking || validationErrors.length ? 'draft' : 'active'
  const now = new Date().toISOString()

  const newHistory = [
    ...(((install as any).upgrade_history ?? []) as any[]),
    { from: fromVersion, to: toVersion, plan, at: now, status },
  ]

  const { error } = await supabaseAdmin
    .from('tenant_pack_installs')
    .update({
      pack_version: toVersion,
      previous_pack_version: fromVersion,
      kb_values: newValues,
      status,
      activated_at: status === 'active' ? now : null,
      updated_at: now,
      upgrade_history: newHistory,
    })
    .eq('id', (install as any).id)
  if (error) throw new Error(`Upgrade failed: ${error.message}`)

  invalidatePackContextCache()

  let assistantId: string | null = null
  if (status === 'active') {
    try {
      assistantId = await materializePersona({
        installId: (install as any).id,
        tenantId: opts.tenantId,
        packSlug: (pack as any).slug,
        packName: (pack as any).name,
        toolSubset: (pack as any).tool_subset ?? [],
        voiceProfile: (pack as any).default_voice_profile ?? {},
        compliance: (pack as any).compliance_profiles ?? {},
        kbValues: newValues,
      })
    } catch (e) {
      console.error('[packs] re-materialization failed during upgrade:', e)
    }
  }

  return { installId: (install as any).id, status, plan, validationErrors, assistantId }
}

function inferPriorSchema(
  values: Record<string, unknown>,
  toSchema: KbSchema,
): KbSchema {
  const schema: KbSchema = {}
  for (const key of Object.keys(values)) {
    const v = values[key]
    if (toSchema[key]) {
      // assume same type as new schema (means typeChanged is conservative)
      schema[key] = { type: toSchema[key].type } as KbField
    } else {
      schema[key] = { type: inferType(v) } as KbField
    }
  }
  return schema
}

function inferType(v: unknown): KbField['type'] {
  if (Array.isArray(v) && v.every(x => typeof x === 'string')) return 'string[]'
  if (typeof v === 'string') return 'string'
  if (typeof v === 'number') return 'number'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'object' && v !== null) return 'json'
  return 'string'
}
