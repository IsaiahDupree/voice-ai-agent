/**
 * Pack export / import.
 *
 * exportPack(slug) → JSON of the pack including its compliance profile,
 * suitable for committing to a migration or sharing across environments.
 *
 * importPack(json) → upserts compliance_profile + industry_pack rows.
 * Same shape exportPack produces, so DB-authored packs round-trip into
 * code-managed seed migrations.
 */

import { supabaseAdmin } from '../supabase'

export interface PackBundle {
  schemaVersion: '1.0'
  pack: {
    slug: string
    name: string
    version: string
    tier: 'A' | 'B' | 'C' | 'D' | null
    status: 'draft' | 'published' | 'deprecated'
    description?: string
    kb_schema: Record<string, unknown>
    tool_subset: string[]
    required_integrations: string[]
    optional_integrations: string[]
    default_voice_profile: Record<string, unknown>
  }
  compliance_profile: {
    slug: string
    name: string
    flags: Record<string, unknown>
    disclosure_templates: Record<string, unknown>
    blocked_phrases: string[]
    required_disclosures: string[]
  } | null
}

export async function exportPack(slug: string): Promise<PackBundle | null> {
  const { data, error } = await supabaseAdmin
    .from('industry_packs')
    .select(
      'slug, name, version, tier, status, description, kb_schema, tool_subset, required_integrations, optional_integrations, default_voice_profile, compliance_profiles:compliance_profile_id (slug, name, flags, disclosure_templates, blocked_phrases, required_disclosures)',
    )
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data) return null
  const p = data as any
  return {
    schemaVersion: '1.0',
    pack: {
      slug: p.slug,
      name: p.name,
      version: p.version,
      tier: p.tier ?? null,
      status: p.status,
      description: p.description ?? undefined,
      kb_schema: p.kb_schema ?? {},
      tool_subset: p.tool_subset ?? [],
      required_integrations: p.required_integrations ?? [],
      optional_integrations: p.optional_integrations ?? [],
      default_voice_profile: p.default_voice_profile ?? {},
    },
    compliance_profile: p.compliance_profiles
      ? {
          slug: p.compliance_profiles.slug,
          name: p.compliance_profiles.name,
          flags: p.compliance_profiles.flags ?? {},
          disclosure_templates: p.compliance_profiles.disclosure_templates ?? {},
          blocked_phrases: p.compliance_profiles.blocked_phrases ?? [],
          required_disclosures: p.compliance_profiles.required_disclosures ?? [],
        }
      : null,
  }
}

export interface ImportResult {
  packSlug: string
  packCreated: boolean
  complianceCreated: boolean
}

export async function importPack(bundle: PackBundle): Promise<ImportResult> {
  if (bundle.schemaVersion !== '1.0') {
    throw new Error(`Unsupported bundle schemaVersion: ${bundle.schemaVersion}`)
  }

  let complianceProfileId: string | null = null
  let complianceCreated = false
  if (bundle.compliance_profile) {
    const { data: existing } = await supabaseAdmin
      .from('compliance_profiles')
      .select('id')
      .eq('slug', bundle.compliance_profile.slug)
      .maybeSingle()
    if (existing) {
      complianceProfileId = (existing as any).id
      await supabaseAdmin
        .from('compliance_profiles')
        .update({
          name: bundle.compliance_profile.name,
          flags: bundle.compliance_profile.flags,
          disclosure_templates: bundle.compliance_profile.disclosure_templates,
          blocked_phrases: bundle.compliance_profile.blocked_phrases,
          required_disclosures: bundle.compliance_profile.required_disclosures,
          updated_at: new Date().toISOString(),
        })
        .eq('id', complianceProfileId)
    } else {
      const { data: created, error } = await supabaseAdmin
        .from('compliance_profiles')
        .insert(bundle.compliance_profile)
        .select('id')
        .single()
      if (error) throw new Error(`compliance insert failed: ${error.message}`)
      complianceProfileId = (created as any).id
      complianceCreated = true
    }
  }

  const packRow = {
    slug: bundle.pack.slug,
    name: bundle.pack.name,
    version: bundle.pack.version,
    tier: bundle.pack.tier,
    status: bundle.pack.status,
    description: bundle.pack.description ?? null,
    compliance_profile_id: complianceProfileId,
    kb_schema: bundle.pack.kb_schema,
    tool_subset: bundle.pack.tool_subset,
    required_integrations: bundle.pack.required_integrations,
    optional_integrations: bundle.pack.optional_integrations,
    default_voice_profile: bundle.pack.default_voice_profile,
    updated_at: new Date().toISOString(),
  }

  const { data: existingPack } = await supabaseAdmin
    .from('industry_packs')
    .select('id')
    .eq('slug', bundle.pack.slug)
    .maybeSingle()
  let packCreated = false
  if (existingPack) {
    const { error } = await supabaseAdmin
      .from('industry_packs')
      .update(packRow)
      .eq('id', (existingPack as any).id)
    if (error) throw new Error(`pack update failed: ${error.message}`)
  } else {
    const { error } = await supabaseAdmin.from('industry_packs').insert(packRow)
    if (error) throw new Error(`pack insert failed: ${error.message}`)
    packCreated = true
  }

  return {
    packSlug: bundle.pack.slug,
    packCreated,
    complianceCreated,
  }
}
