'use client'

import { useEffect, useMemo, useState } from 'react'

interface Violation {
  id: string
  call_id: string | null
  tenant_id: string
  pack_install_id: string | null
  compliance_profile_slug: string | null
  rule: string
  matched_phrase: string
  redacted_utterance: string
  severity: 'warning' | 'blocked'
  source: string | null
  created_at: string
}

const RULE_LABELS: Record<string, string> = {
  blocked_phrase: 'Pack-defined blocked phrase',
  no_diagnosis: 'No diagnosis (HIPAA / vet)',
  no_dosage_change: 'No dosage change',
  no_case_evaluation: 'No case evaluation (UPL)',
  no_finance_quote_without_nmls: 'No rate/APR/payment without NMLS',
  no_allergen_safety_confirmation: 'No allergen safety confirmation',
}

export default function ViolationsPage() {
  const [tenantId, setTenantId] = useState('')
  const [severity, setSeverity] = useState<'' | 'warning' | 'blocked'>('')
  const [rule, setRule] = useState('')
  const [violations, setViolations] = useState<Violation[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [byRule, setByRule] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<Violation | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (tenantId) params.set('tenantId', tenantId)
    if (severity) params.set('severity', severity)
    if (rule) params.set('rule', rule)
    const res = await fetch(`/api/compliance/violations?${params.toString()}`, {
      cache: 'no-store',
    })
    const data = await res.json()
    setViolations(data.violations ?? [])
    setSummary(data.summary ?? {})
    setByRule(data.byRule ?? {})
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [tenantId, severity, rule])

  const ruleOptions = useMemo(() => Object.keys(byRule).sort(), [byRule])

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <header>
        <h1 className="text-2xl font-semibold">Compliance violations</h1>
        <p className="text-sm text-gray-500">
          Server-side classifier hits. Severity <code>warning</code> kept the agent on track;
          severity <code>blocked</code> redacted the utterance before delivery.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 border rounded">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-2xl font-semibold">{violations.length}</div>
        </div>
        <div className="p-3 border rounded">
          <div className="text-xs text-gray-500">Blocked</div>
          <div className="text-2xl font-semibold text-red-600">{summary.blocked ?? 0}</div>
        </div>
        <div className="p-3 border rounded">
          <div className="text-xs text-gray-500">Warnings</div>
          <div className="text-2xl font-semibold text-amber-600">{summary.warning ?? 0}</div>
        </div>
        <div className="p-3 border rounded">
          <div className="text-xs text-gray-500">Distinct rules</div>
          <div className="text-2xl font-semibold">{Object.keys(byRule).length}</div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">
          Tenant
          <input
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            placeholder="any"
            className="ml-2 px-2 py-1 border rounded"
          />
        </label>
        <label className="text-sm">
          Severity
          <select
            value={severity}
            onChange={e => setSeverity(e.target.value as any)}
            className="ml-2 px-2 py-1 border rounded"
          >
            <option value="">any</option>
            <option value="blocked">blocked</option>
            <option value="warning">warning</option>
          </select>
        </label>
        <label className="text-sm">
          Rule
          <select
            value={rule}
            onChange={e => setRule(e.target.value)}
            className="ml-2 px-2 py-1 border rounded"
          >
            <option value="">any</option>
            {ruleOptions.map(r => (
              <option key={r} value={r}>
                {RULE_LABELS[r] ?? r} ({byRule[r]})
              </option>
            ))}
          </select>
        </label>
        <button onClick={load} disabled={loading} className="px-3 py-1 border rounded text-sm">
          {loading ? '…' : 'Reload'}
        </button>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ul className="md:col-span-2 space-y-1">
          {violations.map(v => (
            <li
              key={v.id}
              onClick={() => setSelected(v)}
              className={`p-2 border rounded cursor-pointer text-sm ${
                selected?.id === v.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    v.severity === 'blocked'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {v.severity}
                </span>
                <span className="font-mono text-xs text-gray-500">
                  {RULE_LABELS[v.rule] ?? v.rule}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(v.created_at).toLocaleString()}
                </span>
              </div>
              <div className="font-mono text-xs mt-1 truncate">{v.redacted_utterance}</div>
            </li>
          ))}
          {violations.length === 0 && (
            <li className="text-sm text-gray-500 p-2">No violations match these filters.</li>
          )}
        </ul>

        {selected && (
          <aside className="border rounded p-3 text-sm space-y-2 h-fit sticky top-4">
            <h2 className="font-medium">Drill-down</h2>
            <Field label="Severity" value={selected.severity} />
            <Field label="Rule" value={RULE_LABELS[selected.rule] ?? selected.rule} />
            <Field label="Matched phrase" value={selected.matched_phrase} />
            <Field label="Tenant" value={selected.tenant_id} />
            <Field label="Profile" value={selected.compliance_profile_slug ?? '—'} />
            <Field label="Call" value={selected.call_id ?? '—'} mono />
            <Field label="Source" value={selected.source ?? '—'} />
            <div>
              <div className="text-xs text-gray-500">Redacted utterance</div>
              <pre className="text-xs whitespace-pre-wrap font-mono p-2 bg-gray-50 dark:bg-gray-900 rounded">
                {selected.redacted_utterance}
              </pre>
            </div>
          </aside>
        )}
      </section>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={mono ? 'text-xs font-mono break-all' : 'text-sm'}>{value}</div>
    </div>
  )
}
