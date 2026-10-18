'use client'

import { useEffect, useMemo, useState } from 'react'

interface KbField {
  type: string
  required?: boolean
  description?: string
  enum?: string[]
}

interface PackRow {
  id: string
  slug: string
  name: string
  version: string
  kb_schema: Record<string, KbField>
  required_integrations: string[]
  optional_integrations: string[]
  tool_subset: string[]
}

interface InstallRow {
  id: string
  pack_id: string
  pack_version: string
  status: 'draft' | 'active' | 'suspended' | 'archived'
  kb_values: Record<string, unknown>
  integration_map: Record<string, string>
  industry_packs?: { slug: string; name: string }
}

const PROVIDER_OPTIONS: Record<string, string[]> = {
  calendar: ['cal_com', 'calendly', 'booksy', 'servicetitan', 'opentable'],
  sms: ['twilio'],
  crm: ['supabase', 'vinsolutions'],
  llm: ['anthropic'],
  pms: ['open_dental', 'clio'],
}

// Field shape per provider slug. Used by the credentials panel so the
// UI matches each adapter's required env. Never echoes back values the
// server stored — only collects new ones.
const PROVIDER_FIELDS: Record<string, string[]> = {
  cal_com: ['api_key', 'default_event_type_id'],
  calendly: ['api_token', 'default_event_type_uri'],
  booksy: ['api_key', 'business_id', 'default_service_id'],
  servicetitan: ['tenant_id', 'app_key', 'oauth_token'],
  opentable: ['api_key', 'restaurant_id'],
  twilio: ['account_sid', 'auth_token', 'from_number'],
  vinsolutions: ['api_key', 'dealer_id', 'host'],
  anthropic: ['api_key'],
  open_dental: ['base_url', 'developer_key', 'customer_key'],
  clio: ['api_token', 'region_host'],
}

export default function PacksPage() {
  const [tenantId, setTenantId] = useState<string>('default')
  const [packs, setPacks] = useState<PackRow[]>([])
  const [installs, setInstalls] = useState<InstallRow[]>([])
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [kb, setKb] = useState<Record<string, string>>({})
  const [integrations, setIntegrations] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const selectedPack = useMemo(
    () => packs.find(p => p.slug === selectedSlug) ?? null,
    [packs, selectedSlug],
  )

  const [rollups, setRollups] = useState<any[]>([])

  async function refresh() {
    const [packsRes, rollupRes] = await Promise.all([
      fetch(`/api/packs?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' }),
      fetch(`/api/packs/rollup?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' }),
    ])
    const data = await packsRes.json()
    setPacks(data.packs ?? [])
    setInstalls(data.installs ?? [])
    const r = await rollupRes.json()
    setRollups(r.rollups ?? [])
  }

  useEffect(() => {
    refresh()
  }, [tenantId])

  function startInstall(slug: string) {
    setSelectedSlug(slug)
    setMessage(null)
    setErrors([])
    const pack = packs.find(p => p.slug === slug)
    if (!pack) return

    const existing = installs.find(i => i.industry_packs?.slug === slug)
    setKb(
      existing
        ? Object.fromEntries(
            Object.entries(existing.kb_values).map(([k, v]) => [
              k,
              typeof v === 'string' ? v : JSON.stringify(v),
            ]),
          )
        : {},
    )
    setIntegrations(
      existing?.integration_map ??
        Object.fromEntries(
          pack.required_integrations.map(r => [r, PROVIDER_OPTIONS[r]?.[0] ?? '']),
        ),
    )
  }

  async function submitInstall(activate: boolean) {
    if (!selectedPack) return
    setBusy(true)
    setMessage(null)
    setErrors([])

    const kbValues: Record<string, unknown> = {}
    for (const [field, spec] of Object.entries(selectedPack.kb_schema)) {
      const raw = kb[field]
      if (raw === undefined || raw === '') continue
      if (spec.type === 'string[]') {
        kbValues[field] = raw.split(',').map(s => s.trim()).filter(Boolean)
      } else if (spec.type === 'json' || spec.type === 'weekly_schedule') {
        try {
          kbValues[field] = JSON.parse(raw)
        } catch {
          setErrors(prev => [...prev, `Field "${field}" must be valid JSON`])
          setBusy(false)
          return
        }
      } else if (spec.type === 'number') {
        kbValues[field] = Number(raw)
      } else if (spec.type === 'boolean') {
        kbValues[field] = raw === 'true'
      } else {
        kbValues[field] = raw
      }
    }

    const res = await fetch(`/api/packs/${selectedPack.slug}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId, kbValues, integrationMap: integrations, activate }),
    })
    const data = await res.json()

    if (!res.ok) {
      setErrors(data.errors ?? [data.error ?? 'install failed'])
    } else {
      setMessage(
        data.status === 'active'
          ? `Installed and activated.`
          : `Saved as draft. Resolve validation errors then activate.`,
      )
      if (data.validationErrors?.length) setErrors(data.validationErrors)
      await refresh()
    }
    setBusy(false)
  }

  async function uninstall(slug: string) {
    if (!confirm(`Uninstall ${slug}? This archives the install (reversible).`)) return
    const url = `/api/packs/${slug}/install?tenantId=${encodeURIComponent(tenantId)}`
    await fetch(url, { method: 'DELETE' })
    setSelectedSlug(null)
    await refresh()
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Industry Packs</h1>
          <p className="text-sm text-gray-500">
            Install a vertical pack for a tenant. KB fields and required integrations are validated
            before activation.
          </p>
        </div>
        <label className="text-sm">
          Tenant
          <input
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            className="ml-2 px-2 py-1 border rounded"
          />
        </label>
      </header>

      {rollups.length > 0 && (
        <section>
          <h2 className="font-medium mb-2">ROI rollup</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {rollups.map((r: any) => (
              <div key={r.installId || r.packSlug} className="p-3 border rounded">
                <div className="font-medium">{r.packSlug}</div>
                <div className="text-xs text-gray-500">
                  {r.totalCalls} calls · ${(r.revenueCents / 100).toFixed(0)} est revenue
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(r.totals).map(([outcome, n]: [string, any]) => (
                    <span
                      key={outcome}
                      className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800"
                    >
                      {outcome}: {n}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ComplianceGates rollups={rollups} />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="font-medium mb-2">Available packs</h2>
          <ul className="space-y-2">
            {packs.map(p => {
              const install = installs.find(i => i.industry_packs?.slug === p.slug)
              return (
                <li
                  key={p.id}
                  className={`p-3 border rounded cursor-pointer ${
                    selectedSlug === p.slug ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''
                  }`}
                  onClick={() => startInstall(p.slug)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-gray-500">v{p.version}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Requires: {p.required_integrations.join(', ') || '—'}
                  </div>
                  {install && (
                    <div
                      className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${
                        install.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {install.status}
                    </div>
                  )}
                </li>
              )
            })}
            {packs.length === 0 && <li className="text-sm text-gray-500">No published packs.</li>}
          </ul>
        </div>

        <div>
          {selectedPack ? (
            <div className="space-y-4">
              <h2 className="font-medium">Install {selectedPack.name}</h2>

              <div>
                <h3 className="text-sm font-medium mb-2">Knowledge base</h3>
                <div className="space-y-2">
                  {Object.entries(selectedPack.kb_schema).map(([field, spec]) => (
                    <div key={field}>
                      <label className="text-xs text-gray-600 flex items-center gap-1">
                        {field}
                        {spec.required && <span className="text-red-500">*</span>}
                        <span className="text-gray-400">({spec.type})</span>
                      </label>
                      <textarea
                        value={kb[field] ?? ''}
                        onChange={e => setKb({ ...kb, [field]: e.target.value })}
                        placeholder={spec.description ?? ''}
                        className="w-full px-2 py-1 border rounded text-sm font-mono"
                        rows={spec.type === 'json' || spec.type === 'weekly_schedule' ? 3 : 1}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Integrations</h3>
                <div className="space-y-2">
                  {selectedPack.required_integrations.map(req => (
                    <div key={req} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-24">{req}*</span>
                      <select
                        value={integrations[req] ?? ''}
                        onChange={e => setIntegrations({ ...integrations, [req]: e.target.value })}
                        className="px-2 py-1 border rounded text-sm flex-1"
                      >
                        <option value="">— select provider —</option>
                        {(PROVIDER_OPTIONS[req] ?? []).map(p => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <CredentialsPanel
                tenantId={tenantId}
                packSlug={selectedPack.slug}
                integrations={integrations}
              />

              {errors.length > 0 && (
                <div className="p-2 bg-red-50 text-red-700 rounded text-sm">
                  <ul className="list-disc list-inside">
                    {errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {message && (
                <div className="p-2 bg-green-50 text-green-700 rounded text-sm">{message}</div>
              )}

              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => submitInstall(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                >
                  Save & activate
                </button>
                <button
                  disabled={busy}
                  onClick={() => submitInstall(false)}
                  className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
                >
                  Save draft
                </button>
                {installs.find(i => i.industry_packs?.slug === selectedPack.slug) && (
                  <button
                    onClick={() => uninstall(selectedPack.slug)}
                    className="px-3 py-1.5 border border-red-300 text-red-600 rounded text-sm ml-auto"
                  >
                    Uninstall
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Select a pack to install or edit.</div>
          )}
        </div>
      </section>
    </div>
  )
}

function CredentialsPanel({
  tenantId,
  packSlug,
  integrations,
}: {
  tenantId: string
  packSlug: string
  integrations: Record<string, string>
}) {
  const [configured, setConfigured] = useState<Record<string, Record<string, boolean>>>({})
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Provider slugs that the current integration_map points to.
  const slugs = useMemo(() => {
    return [...new Set(Object.values(integrations).filter(Boolean))]
  }, [integrations])

  async function loadSummary() {
    if (!tenantId || !packSlug) return
    const url = `/api/packs/${packSlug}/credentials?tenantId=${encodeURIComponent(tenantId)}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      setConfigured({})
      return
    }
    const data = await res.json()
    setConfigured(data.configured ?? {})
  }

  useEffect(() => {
    loadSummary()
  }, [tenantId, packSlug])

  async function save() {
    setBusy(true)
    setMsg(null)
    // Merge draft over the configured map but only send keys the user
    // actually touched (so we don't blow away server-side values with
    // empty strings).
    const credentials: Record<string, Record<string, string>> = {}
    for (const [provider, kv] of Object.entries(draft)) {
      const filled = Object.fromEntries(Object.entries(kv).filter(([, v]) => v.trim() !== ''))
      if (Object.keys(filled).length) credentials[provider] = filled
    }
    if (Object.keys(credentials).length === 0) {
      setMsg('No new values to save.')
      setBusy(false)
      return
    }
    const res = await fetch(`/api/packs/${packSlug}/credentials`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId, credentials }),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      setMsg(`Save failed: ${e.error ?? res.status}`)
    } else {
      setMsg('Saved.')
      setDraft({})
      await loadSummary()
    }
    setBusy(false)
  }

  if (slugs.length === 0) {
    return (
      <div className="text-xs text-gray-500 border-t pt-3">
        Credentials: pick at least one provider above first.
      </div>
    )
  }

  return (
    <div className="space-y-3 border-t pt-3">
      <h3 className="text-sm font-medium">Credentials</h3>
      <p className="text-xs text-gray-500">
        Stored encrypted at rest. The server never returns existing values — leave a field blank to
        keep the current value.
      </p>
      {slugs.map(slug => {
        const fields = PROVIDER_FIELDS[slug] ?? []
        if (fields.length === 0) return null
        return (
          <div key={slug} className="border rounded p-2">
            <div className="font-mono text-xs font-medium mb-2">{slug}</div>
            <div className="grid grid-cols-1 gap-2">
              {fields.map(f => {
                const set = configured[slug]?.[f]
                return (
                  <label key={f} className="text-xs flex items-center gap-2">
                    <span className="w-32 text-gray-600">
                      {f}{' '}
                      <span className={set ? 'text-green-600' : 'text-gray-400'}>
                        {set ? '●' : '○'}
                      </span>
                    </span>
                    <input
                      type="password"
                      autoComplete="off"
                      placeholder={set ? '(set — leave blank to keep)' : 'unset'}
                      value={draft[slug]?.[f] ?? ''}
                      onChange={e =>
                        setDraft(d => ({
                          ...d,
                          [slug]: { ...(d[slug] ?? {}), [f]: e.target.value },
                        }))
                      }
                      className="flex-1 px-2 py-1 border rounded text-xs font-mono"
                    />
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="px-3 py-1.5 bg-gray-700 text-white rounded text-xs disabled:opacity-50"
        >
          Save credentials
        </button>
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>
    </div>
  )
}

const GATE_OUTCOMES = [
  { key: 'rnd_blocked', label: 'RND blocked', tone: 'red', explain: 'Reassigned-Numbers-Database hit; outbound dial halted before connect.' },
  { key: 'dnc_blocked', label: 'DNC blocked', tone: 'red', explain: 'Federal/state/internal DNC scrub blocked the dial.' },
  { key: 'carrier_not_appointed', label: 'Carrier not appointed', tone: 'amber', explain: 'AI declined to quote a carrier the agency is not appointed with for the caller\u2019s state \u00d7 LOB.' },
  { key: 'producer_not_licensed', label: 'No licensed producer', tone: 'amber', explain: 'AI declined a quote because no licensed producer of record exists for state \u00d7 LOB.' },
  { key: 'soa_captured', label: 'Medicare SOA captured', tone: 'green', explain: 'Scope of Appointment captured before plan-benefit discussion.' },
  { key: 'tpmo_disclosed', label: 'TPMO disclaimer read', tone: 'green', explain: 'CY2026-placement TPMO disclaimer logged before benefits.' },
] as const

const TONE_CLASSES: Record<string, string> = {
  red: 'border-red-300 bg-red-50 text-red-700',
  amber: 'border-amber-300 bg-amber-50 text-amber-700',
  green: 'border-emerald-300 bg-emerald-50 text-emerald-700',
}

function ComplianceGates({ rollups }: { rollups: any[] }) {
  const totals: Record<string, number> = {}
  let hasAny = false
  for (const r of rollups) {
    for (const { key } of GATE_OUTCOMES) {
      const n = Number((r.totals ?? {})[key] ?? 0)
      if (n > 0) hasAny = true
      totals[key] = (totals[key] ?? 0) + n
    }
  }
  if (!hasAny) return null

  return (
    <section>
      <h2 className="font-medium mb-2">Compliance gates</h2>
      <p className="text-xs text-gray-500 mb-3">
        Blocking events (red), honest declines (amber), and required disclosures (green) — the audit
        story that proves enforcement, not just claims.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {GATE_OUTCOMES.map(g => {
          const n = totals[g.key] ?? 0
          if (n === 0) return null
          return (
            <div key={g.key} className={`p-3 border rounded ${TONE_CLASSES[g.tone]}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{g.label}</span>
                <span className="text-xl font-semibold tabular-nums">{n}</span>
              </div>
              <div className="text-xs mt-1 opacity-80">{g.explain}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
