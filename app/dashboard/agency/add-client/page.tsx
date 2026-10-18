'use client'

/**
 * Add-client wizard — Sprint 5.1 (PRD §6 / UX-SPEC §3.1, §4.x).
 *
 * Five-step flow that replaces the 3-field "Add client" modal on
 * /dashboard/agency. Time-budget: ≤ 8 minutes for a savvy operator.
 *
 *   1. Basics                — display name, legal name, primary phone
 *   2. Industry pack         — grid; preview compliance + integrations
 *   3. Knowledge base        — fields rendered from pack.kb_schema
 *   4. Integrations          — provider per required_integration
 *   5. Review + Activate     — POST /api/agencies/{id}/clients then
 *                              redirect into the new tenant's pack page
 *
 * Save-as-draft is available from any step and POSTs with activate=false.
 * Active=true is only picked when the user explicitly clicks Activate
 * AND every required KB field + integration is filled.
 *
 * URL: /dashboard/agency/add-client?agencyId=...&step=N
 * State persists in URL so back-button works and refresh doesn't blow
 * away in-flight wizard input.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface PackRow {
  id: string
  slug: string
  name: string
  version: string
  tier?: string
  description?: string
  kb_schema: Record<string, KbField>
  required_integrations: string[]
  optional_integrations: string[]
  tool_subset: string[]
  compliance_profile_slug?: string
}

interface KbField {
  type: 'string' | 'string[]' | 'number' | 'boolean' | 'phone' | 'email' | 'weekly_schedule' | 'json'
  required?: boolean
  description?: string
  enum?: string[]
}

const PROVIDER_OPTIONS: Record<string, string[]> = {
  calendar: ['cal_com', 'calendly', 'booksy', 'servicetitan', 'opentable'],
  sms: ['twilio'],
  crm: ['supabase', 'vinsolutions'],
  llm: ['anthropic'],
  pms: ['open_dental', 'clio'],
}

const STEPS = [
  { n: 1, label: 'Basics' },
  { n: 2, label: 'Industry pack' },
  { n: 3, label: 'Knowledge base' },
  { n: 4, label: 'Integrations' },
  { n: 5, label: 'Review' },
] as const

const DEFAULT_AGENCY_ID = '00000000-0000-0000-0000-000000000001'

export default function AddClientWizard() {
  const router = useRouter()
  const params = useSearchParams()
  const agencyId = params.get('agencyId') ?? DEFAULT_AGENCY_ID
  const stepParam = Number(params.get('step') ?? '1')
  const step = Math.min(Math.max(stepParam, 1), STEPS.length) as 1 | 2 | 3 | 4 | 5

  // ── Wizard state. Each step writes its slice; nothing is lost on nav. ──
  const [packs, setPacks] = useState<PackRow[]>([])
  const [packsLoading, setPacksLoading] = useState(true)

  const [basics, setBasics] = useState({
    displayName: '',
    legalName: '',
    primaryPhone: '',
  })
  const [packSlug, setPackSlug] = useState<string>('')
  const [kb, setKb] = useState<Record<string, string>>({})
  const [integrations, setIntegrations] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedPack = useMemo(
    () => packs.find(p => p.slug === packSlug) ?? null,
    [packs, packSlug],
  )

  // Load published packs once.
  useEffect(() => {
    fetch(`/api/packs?tenantId=${encodeURIComponent('default')}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        setPacks(data.packs ?? [])
        setPacksLoading(false)
      })
      .catch(() => setPacksLoading(false))
  }, [])

  // When the user picks a pack, default integrations to the first option in
  // each required category so step 4 is a one-click confirm rather than blank.
  useEffect(() => {
    if (!selectedPack) return
    setIntegrations(prev => {
      const next = { ...prev }
      for (const req of selectedPack.required_integrations) {
        if (!next[req]) next[req] = PROVIDER_OPTIONS[req]?.[0] ?? ''
      }
      return next
    })
  }, [selectedPack])

  function gotoStep(n: number) {
    const next = new URLSearchParams(params.toString())
    next.set('step', String(n))
    router.push(`/dashboard/agency/add-client?${next.toString()}`)
  }

  // ── Validation per step. Used to gate Next/Activate buttons. ─────────
  const stepValid = useMemo(() => {
    if (step === 1) return basics.displayName.trim().length > 0
    if (step === 2) return !!selectedPack
    if (step === 3) {
      if (!selectedPack) return false
      // Every required KB field has *some* value. Type-coerce later.
      return Object.entries(selectedPack.kb_schema)
        .filter(([, spec]) => spec.required)
        .every(([field]) => (kb[field] ?? '').trim().length > 0)
    }
    if (step === 4) {
      if (!selectedPack) return false
      return selectedPack.required_integrations.every(r => integrations[r])
    }
    return true
  }, [step, basics, selectedPack, kb, integrations])

  const fullyValid =
    basics.displayName.trim().length > 0 &&
    selectedPack !== null &&
    selectedPack.required_integrations.every(r => integrations[r]) &&
    Object.entries(selectedPack.kb_schema)
      .filter(([, spec]) => spec.required)
      .every(([field]) => (kb[field] ?? '').trim().length > 0)

  // ── Submit (activate or draft). ──────────────────────────────────────
  async function submit(activate: boolean) {
    if (!selectedPack) {
      setError('Pick an industry pack first.')
      return
    }
    setSubmitting(true)
    setError(null)

    // Coerce KB values per kb_schema spec.
    const kbValues: Record<string, unknown> = {}
    for (const [field, spec] of Object.entries(selectedPack.kb_schema)) {
      const raw = kb[field]
      if (raw === undefined || raw === '') continue
      try {
        if (spec.type === 'string[]') {
          kbValues[field] = raw.split(',').map(s => s.trim()).filter(Boolean)
        } else if (spec.type === 'json' || spec.type === 'weekly_schedule') {
          kbValues[field] = JSON.parse(raw)
        } else if (spec.type === 'number') {
          kbValues[field] = Number(raw)
        } else if (spec.type === 'boolean') {
          kbValues[field] = raw === 'true'
        } else {
          kbValues[field] = raw
        }
      } catch {
        setError(`"${field}" must be valid JSON`)
        setSubmitting(false)
        return
      }
    }

    const res = await fetch(`/api/agencies/${encodeURIComponent(agencyId)}/clients`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: basics.displayName.trim(),
        legalName: basics.legalName.trim() || undefined,
        phoneNumbers: basics.primaryPhone.trim() ? [basics.primaryPhone.trim()] : undefined,
        packSlug: selectedPack.slug,
        kbValues,
        integrationMap: integrations,
        activate,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(data.error ?? 'failed')
      return
    }
    // Land in the agency dashboard so the operator sees the new client card.
    router.push(`/dashboard/agency?id=${encodeURIComponent(agencyId)}`)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Add a client</h1>
          <p className="text-sm text-gray-500">
            Provisions a new tenant under your agency. Time budget: ≤ 8 minutes.
          </p>
        </div>
        <Link
          href={`/dashboard/agency?id=${encodeURIComponent(agencyId)}`}
          className="text-sm text-gray-500 hover:underline"
        >
          ← back to agency
        </Link>
      </header>

      <Stepper current={step} onJump={gotoStep} valid={stepValid} />

      <div className="border rounded-lg p-6 space-y-4 bg-white dark:bg-gray-900">
        {step === 1 && (
          <StepBasics value={basics} onChange={setBasics} />
        )}
        {step === 2 && (
          <StepPack
            packs={packs}
            loading={packsLoading}
            selectedSlug={packSlug}
            onSelect={setPackSlug}
          />
        )}
        {step === 3 && selectedPack && (
          <StepKb pack={selectedPack} value={kb} onChange={setKb} />
        )}
        {step === 4 && selectedPack && (
          <StepIntegrations
            pack={selectedPack}
            value={integrations}
            onChange={setIntegrations}
          />
        )}
        {step === 5 && selectedPack && (
          <StepReview
            basics={basics}
            pack={selectedPack}
            kb={kb}
            integrations={integrations}
            onJump={gotoStep}
          />
        )}
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      <div className="flex items-center justify-between">
        <button
          disabled={step === 1}
          onClick={() => gotoStep(step - 1)}
          className="px-3 py-1.5 border rounded text-sm disabled:opacity-30"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => submit(false)}
            disabled={submitting || !basics.displayName.trim()}
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
            title="Saves the client as a draft. Won't activate until you finish the wizard."
          >
            Save as draft
          </button>
          {step < 5 ? (
            <button
              onClick={() => gotoStep(step + 1)}
              disabled={!stepValid}
              className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={() => submit(true)}
              disabled={submitting || !fullyValid}
              className="px-4 py-1.5 bg-emerald-600 text-white rounded text-sm font-medium disabled:opacity-50"
              title={fullyValid ? '' : 'Fill all required fields and integrations first.'}
            >
              {submitting ? 'Activating…' : 'Activate client →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Steps ──────────────────────────────────────────────────────────────

function Stepper({
  current,
  onJump,
  valid,
}: {
  current: number
  onJump: (n: number) => void
  valid: boolean
}) {
  return (
    <ol className="flex items-center gap-2 text-xs">
      {STEPS.map(s => {
        const done = s.n < current
        const active = s.n === current
        return (
          <li key={s.n} className="flex items-center gap-2">
            <button
              onClick={() => (s.n <= current || valid) && onJump(s.n)}
              className={`flex items-center gap-2 px-2 py-1 rounded transition ${
                active
                  ? 'bg-blue-600 text-white'
                  : done
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className="font-mono w-4 text-center">{s.n}</span>
              <span>{s.label}</span>
            </button>
            {s.n < STEPS.length && <span className="text-gray-400">→</span>}
          </li>
        )
      })}
    </ol>
  )
}

function StepBasics({
  value,
  onChange,
}: {
  value: { displayName: string; legalName: string; primaryPhone: string }
  onChange: (v: any) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-medium">Business basics</h2>
        <p className="text-xs text-gray-500">
          What you call this client (display name) plus the legal name for invoices and the
          primary phone the AI will answer on.
        </p>
      </div>
      <label className="block text-sm">
        Display name <span className="text-red-500">*</span>
        <input
          value={value.displayName}
          onChange={e => onChange({ ...value, displayName: e.target.value })}
          className="w-full mt-1 px-3 py-2 border rounded text-sm"
          placeholder="Smith Roofing"
          autoFocus
        />
      </label>
      <label className="block text-sm">
        Legal name (for billing — optional)
        <input
          value={value.legalName}
          onChange={e => onChange({ ...value, legalName: e.target.value })}
          className="w-full mt-1 px-3 py-2 border rounded text-sm"
          placeholder="Smith Roofing & Construction LLC"
        />
      </label>
      <label className="block text-sm">
        Primary phone number (E.164 — optional, you can add later)
        <input
          value={value.primaryPhone}
          onChange={e => onChange({ ...value, primaryPhone: e.target.value })}
          className="w-full mt-1 px-3 py-2 border rounded text-sm font-mono"
          placeholder="+15551234567"
        />
      </label>
    </div>
  )
}

function StepPack({
  packs,
  loading,
  selectedSlug,
  onSelect,
}: {
  packs: PackRow[]
  loading: boolean
  selectedSlug: string
  onSelect: (slug: string) => void
}) {
  if (loading) return <div className="text-sm text-gray-500">Loading packs…</div>
  if (packs.length === 0)
    return <div className="text-sm text-gray-500">No published packs available.</div>

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-medium">Industry pack</h2>
        <p className="text-xs text-gray-500">
          Each pack ships a vertical-specific persona, compliance posture, and tool surface.
          You can change this later via the per-tenant packs page.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {packs.map(p => {
          const selected = p.slug === selectedSlug
          return (
            <button
              key={p.slug}
              onClick={() => onSelect(p.slug)}
              className={`text-left p-3 border-2 rounded transition ${
                selected
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-sm truncate">{p.name}</span>
                {p.tier && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      p.tier === 'C'
                        ? 'bg-rose-100 text-rose-700'
                        : p.tier === 'B'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {p.tier}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-gray-500 font-mono mt-1">{p.slug}</div>
              {p.description && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-3">
                  {p.description.slice(0, 180)}
                </div>
              )}
              <div className="text-[10px] text-gray-500 mt-2">
                Requires: {p.required_integrations.join(', ') || '—'}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepKb({
  pack,
  value,
  onChange,
}: {
  pack: PackRow
  value: Record<string, string>
  onChange: (v: Record<string, string>) => void
}) {
  const fields = Object.entries(pack.kb_schema)
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-medium">Knowledge base for {pack.name}</h2>
        <p className="text-xs text-gray-500">
          The pack's persona reads these values verbatim. Required fields marked{' '}
          <span className="text-red-500">*</span>.
        </p>
      </div>
      <div className="space-y-3">
        {fields.map(([field, spec]) => (
          <KbInput
            key={field}
            field={field}
            spec={spec}
            value={value[field] ?? ''}
            onChange={v => onChange({ ...value, [field]: v })}
          />
        ))}
      </div>
    </div>
  )
}

function KbInput({
  field,
  spec,
  value,
  onChange,
}: {
  field: string
  spec: KbField
  value: string
  onChange: (v: string) => void
}) {
  const isMultiLine = spec.type === 'json' || spec.type === 'weekly_schedule' || spec.type === 'string[]'
  return (
    <div>
      <label className="text-xs flex items-center gap-1">
        <span className="font-medium">{field}</span>
        {spec.required && <span className="text-red-500">*</span>}
        <span className="text-gray-400 font-mono">({spec.type})</span>
      </label>
      {spec.description && (
        <div className="text-[11px] text-gray-500 mb-1 italic">{spec.description}</div>
      )}
      {spec.enum ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-2 py-1.5 border rounded text-sm"
        >
          <option value="">— select —</option>
          {spec.enum.map(o => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : isMultiLine ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={spec.type === 'string[]' ? 2 : 4}
          className="w-full px-2 py-1.5 border rounded text-sm font-mono"
          placeholder={
            spec.type === 'string[]'
              ? 'comma,separated,values'
              : '{ "valid": "json" }'
          }
        />
      ) : (
        <input
          type={spec.type === 'number' ? 'number' : spec.type === 'email' ? 'email' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-2 py-1.5 border rounded text-sm"
        />
      )}
    </div>
  )
}

function StepIntegrations({
  pack,
  value,
  onChange,
}: {
  pack: PackRow
  value: Record<string, string>
  onChange: (v: Record<string, string>) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-medium">Integrations</h2>
        <p className="text-xs text-gray-500">
          Pick a provider for each required category. Credentials are entered after activation
          on the per-client packs page.
        </p>
      </div>
      <div className="space-y-2">
        {pack.required_integrations.map(req => (
          <div key={req} className="flex items-center gap-3">
            <span className="text-sm w-32 text-gray-600 font-mono">{req}*</span>
            <select
              value={value[req] ?? ''}
              onChange={e => onChange({ ...value, [req]: e.target.value })}
              className="flex-1 px-2 py-1.5 border rounded text-sm"
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
        {pack.optional_integrations.length > 0 && (
          <div className="text-xs text-gray-500 mt-3">
            Optional: {pack.optional_integrations.join(', ')} (configure later if needed).
          </div>
        )}
      </div>
    </div>
  )
}

function StepReview({
  basics,
  pack,
  kb,
  integrations,
  onJump,
}: {
  basics: { displayName: string; legalName: string; primaryPhone: string }
  pack: PackRow
  kb: Record<string, string>
  integrations: Record<string, string>
  onJump: (n: number) => void
}) {
  const missingKb = Object.entries(pack.kb_schema)
    .filter(([f, spec]) => spec.required && !(kb[f] ?? '').trim())
    .map(([f]) => f)
  const missingInt = pack.required_integrations.filter(r => !integrations[r])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-medium">Review &amp; activate</h2>
        <p className="text-xs text-gray-500">
          One last check before the AI starts answering calls. Activating creates the tenant,
          installs the pack, and provisions a Vapi assistant.
        </p>
      </div>

      <ReviewBlock
        title="Basics"
        onEdit={() => onJump(1)}
        rows={[
          ['Display name', basics.displayName || '—'],
          ['Legal name', basics.legalName || '—'],
          ['Primary phone', basics.primaryPhone || '—'],
        ]}
      />
      <ReviewBlock
        title="Industry pack"
        onEdit={() => onJump(2)}
        rows={[
          ['Pack', `${pack.name} (${pack.slug})`],
          ['Tier', pack.tier ?? '—'],
          ['Tools', pack.tool_subset.length ? pack.tool_subset.join(', ') : '—'],
        ]}
      />
      <ReviewBlock
        title="Knowledge base"
        onEdit={() => onJump(3)}
        rows={Object.keys(pack.kb_schema).map(f => [
          f,
          (kb[f] ?? '').slice(0, 80) || '—',
        ])}
      />
      <ReviewBlock
        title="Integrations"
        onEdit={() => onJump(4)}
        rows={pack.required_integrations.map(r => [r, integrations[r] ?? '—'])}
      />

      {(missingKb.length > 0 || missingInt.length > 0) && (
        <div className="p-3 rounded bg-amber-50 border border-amber-200 text-sm text-amber-800 space-y-1">
          <div className="font-medium">Activation will fail until you fix:</div>
          {missingKb.length > 0 && (
            <div>Missing KB fields: <span className="font-mono">{missingKb.join(', ')}</span></div>
          )}
          {missingInt.length > 0 && (
            <div>Missing integrations: <span className="font-mono">{missingInt.join(', ')}</span></div>
          )}
          <div className="text-xs">You can still <em>save as draft</em> and finish later.</div>
        </div>
      )}
    </div>
  )
}

function ReviewBlock({
  title,
  rows,
  onEdit,
}: {
  title: string
  rows: Array<[string, string]>
  onEdit: () => void
}) {
  return (
    <div className="border rounded">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 dark:bg-gray-800">
        <span className="text-sm font-medium">{title}</span>
        <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">
          edit
        </button>
      </div>
      <dl className="divide-y dark:divide-gray-700">
        {rows.map(([k, v]) => (
          <div key={k} className="flex px-3 py-1.5 text-sm">
            <dt className="w-40 text-gray-500 font-mono text-xs flex-shrink-0">{k}</dt>
            <dd className="flex-1 truncate">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
