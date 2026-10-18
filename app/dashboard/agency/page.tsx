'use client'

/**
 * Agency dashboard — Sprint 1.5 (PRD §6).
 *
 * Agency owner's home: grid of all SMB clients with KPI rollups
 * (calls, bookings, qualified leads, missed-call recoveries, est.
 * revenue, last call). One-click drill-in to the per-client packs page.
 *
 * Today the agencyId comes from a query param (or defaults to the
 * seeded default-agency UUID). Sprint 4 wires it to the auth'd user
 * via getAgencyForUser.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

interface Followup {
  id: string
  call_id: string
  tenant_id: string
  tenant_display_name: string
  pack_slug: string | null
  next_action: string
  template_name: string | null
  rendered_body: string | null
  to_phone: string | null
  scheduled_for: string | null
  lead_score: number | null
  status: 'queued' | 'sent' | 'skipped' | 'failed'
  skip_reason: string | null
  created_at: string
}

interface ClientKpi {
  tenantId: string
  displayName: string
  packSlug: string | null
  totalCalls: number
  bookedAppointments: number
  qualifiedLeads: number
  missedCallRecoveries: number
  highValueLeads: number
  complianceGateHits: number
  estRevenueCents: number
  lastCallAt: string | null
  avgLeadScore: number | null
  hotLeads: number
  nextActions: Record<string, number>
}

interface Agency {
  id: string
  slug: string
  name: string
  plan: string
  max_clients: number
  status: string
}

const DEFAULT_AGENCY_ID = '00000000-0000-0000-0000-000000000001'

const PACK_OPTIONS = [
  'salon_barbershop',
  'vet_clinic',
  'restaurant',
  'home_services',
  'dental_practice',
  'legal_intake',
  'mortgage_lender',
  'dealership_bdc',
  'insurance_agency',
]

export default function AgencyDashboard() {
  const [agencyId, setAgencyId] = useState<string>(DEFAULT_AGENCY_ID)
  const [agency, setAgency] = useState<Agency | null>(null)
  const [clients, setClients] = useState<ClientKpi[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [form, setForm] = useState({ displayName: '', legalName: '', packSlug: '' })
  const [digestFor, setDigestFor] = useState<{ tenantId: string; displayName: string } | null>(
    null,
  )
  const [ownerLinkFor, setOwnerLinkFor] = useState<
    { tenantId: string; displayName: string } | null
  >(null)

  async function refresh() {
    setLoading(true)
    const [aRes, cRes, fRes] = await Promise.all([
      fetch(`/api/agencies?id=${encodeURIComponent(agencyId)}`, { cache: 'no-store' })
        .then(r => r.json())
        .catch(() => ({ agencies: [] })),
      fetch(`/api/agencies/${encodeURIComponent(agencyId)}/clients`, { cache: 'no-store' })
        .then(r => r.json())
        .catch(() => ({ clients: [] })),
      fetch(`/api/agencies/${encodeURIComponent(agencyId)}/followups?limit=20`, { cache: 'no-store' })
        .then(r => r.json())
        .catch(() => ({ followups: [] })),
    ])
    const found =
      (aRes.agencies ?? []).find((a: Agency) => a.id === agencyId) ??
      (aRes.agency ?? null)
    setAgency(found ?? null)
    setClients(cRes.clients ?? [])
    setFollowups(fRes.followups ?? [])
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [agencyId])

  const totals = useMemo(() => {
    return clients.reduce(
      (acc, c) => ({
        calls: acc.calls + c.totalCalls,
        bookings: acc.bookings + c.bookedAppointments,
        qualified: acc.qualified + c.qualifiedLeads,
        missed: acc.missed + c.missedCallRecoveries,
        revenue: acc.revenue + c.estRevenueCents,
        hot: acc.hot + c.hotLeads,
      }),
      { calls: 0, bookings: 0, qualified: 0, missed: 0, revenue: 0, hot: 0 },
    )
  }, [clients])

  async function addClient() {
    setAdding(true)
    setAddError(null)
    const res = await fetch(`/api/agencies/${encodeURIComponent(agencyId)}/clients`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: form.displayName,
        legalName: form.legalName || undefined,
        packSlug: form.packSlug || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setAddError(data.error ?? 'add failed')
      setAdding(false)
      return
    }
    setShowAdd(false)
    setForm({ displayName: '', legalName: '', packSlug: '' })
    setAdding(false)
    await refresh()
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agency Dashboard</h1>
          <p className="text-sm text-gray-500">
            Your book of SMB clients. KPIs rolled up over the last 30 days.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm">
            Agency
            <input
              value={agencyId}
              onChange={e => setAgencyId(e.target.value)}
              className="ml-2 px-2 py-1 border rounded font-mono text-xs w-72"
            />
          </label>
          <Link
            href={`/dashboard/agency/settings?id=${encodeURIComponent(agencyId)}`}
            className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Settings
          </Link>
          <Link
            href={`/dashboard/agency/add-client?agencyId=${encodeURIComponent(agencyId)}`}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm"
          >
            Add client
          </Link>
        </div>
      </header>

      {agency && (
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium">{agency.name}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
            {agency.plan} · {clients.length}/{agency.max_clients} clients
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              agency.status === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {agency.status}
          </span>
        </div>
      )}

      {/* Top-line totals */}
      <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiTile label="Total calls" value={totals.calls} />
        <KpiTile label="Booked" value={totals.bookings} accent="green" />
        <KpiTile label="Qualified leads" value={totals.qualified} accent="blue" />
        <KpiTile label="Hot leads (75+)" value={totals.hot} accent="red" />
        <KpiTile label="Missed-call recoveries" value={totals.missed} accent="amber" />
        <KpiTile label="Est. revenue" value={`$${(totals.revenue / 100).toFixed(0)}`} accent="green" />
      </section>

      {/* Client grid */}
      <section>
        <h2 className="font-medium mb-2">Clients</h2>
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : clients.length === 0 ? (
          <div className="text-sm text-gray-500 border rounded p-6 text-center">
            No clients yet — click <span className="font-medium">Add client</span> to provision
            the first SMB tenant under this agency.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {clients.map(c => (
              <ClientCard
                key={c.tenantId}
                c={c}
                onDigest={() => setDigestFor({ tenantId: c.tenantId, displayName: c.displayName })}
                onOwnerLink={() =>
                  setOwnerLinkFor({ tenantId: c.tenantId, displayName: c.displayName })
                }
              />
            ))}
          </div>
        )}
      </section>

      <FollowupActivity rows={followups} />

      {digestFor && (
        <DigestModal
          agencyId={agencyId}
          tenantId={digestFor.tenantId}
          displayName={digestFor.displayName}
          onClose={() => setDigestFor(null)}
        />
      )}

      {ownerLinkFor && (
        <OwnerLinkModal
          agencyId={agencyId}
          tenantId={ownerLinkFor.tenantId}
          displayName={ownerLinkFor.displayName}
          onClose={() => setOwnerLinkFor(null)}
        />
      )}

      {/* Add-client modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="font-medium">Add client</h3>
            <label className="block text-sm">
              Display name
              <input
                value={form.displayName}
                onChange={e => setForm({ ...form, displayName: e.target.value })}
                className="w-full mt-1 px-2 py-1 border rounded text-sm"
                placeholder="Smith Roofing"
              />
            </label>
            <label className="block text-sm">
              Legal name (optional)
              <input
                value={form.legalName}
                onChange={e => setForm({ ...form, legalName: e.target.value })}
                className="w-full mt-1 px-2 py-1 border rounded text-sm"
                placeholder="Smith Roofing & Construction LLC"
              />
            </label>
            <label className="block text-sm">
              Industry pack
              <select
                value={form.packSlug}
                onChange={e => setForm({ ...form, packSlug: e.target.value })}
                className="w-full mt-1 px-2 py-1 border rounded text-sm"
              >
                <option value="">— skip for now —</option>
                {PACK_OPTIONS.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            {addError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{addError}</div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="px-3 py-1.5 border rounded text-sm"
                disabled={adding}
              >
                Cancel
              </button>
              <button
                onClick={addClient}
                disabled={adding || !form.displayName.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
              >
                {adding ? 'Provisioning…' : 'Provision client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: 'green' | 'blue' | 'amber' | 'red'
}) {
  const accentClass =
    accent === 'green'
      ? 'text-emerald-700'
      : accent === 'blue'
        ? 'text-blue-700'
        : accent === 'amber'
          ? 'text-amber-700'
          : accent === 'red'
            ? 'text-rose-700'
            : 'text-gray-900 dark:text-gray-100'
  return (
    <div className="p-3 border rounded">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${accentClass}`}>{value}</div>
    </div>
  )
}

function ClientCard({
  c,
  onDigest,
  onOwnerLink,
}: {
  c: ClientKpi
  onDigest: () => void
  onOwnerLink: () => void
}) {
  const last = c.lastCallAt ? new Date(c.lastCallAt) : null
  const lastLabel = last
    ? `${Math.round((Date.now() - last.getTime()) / 3600000)}h ago`
    : '—'
  const topActions = Object.entries(c.nextActions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
  return (
    <div className="p-4 border rounded space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Link
          href={`/dashboard/packs?tenantId=${encodeURIComponent(c.tenantId)}`}
          className="font-medium hover:underline truncate"
        >
          {c.displayName}
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          {c.packSlug && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">
              {c.packSlug}
            </span>
          )}
          <button
            onClick={onDigest}
            className="text-xs px-2 py-0.5 rounded border hover:bg-gray-50 dark:hover:bg-gray-800"
            title="Preview / send sample digest"
          >
            Digest
          </button>
          <button
            onClick={onOwnerLink}
            className="text-xs px-2 py-0.5 rounded border hover:bg-gray-50 dark:hover:bg-gray-800"
            title="Owner-portal link for this client"
          >
            Owner link
          </button>
        </div>
      </div>
      {c.avgLeadScore !== null && (
        <div className="flex items-center gap-2 text-xs">
          <LeadScoreBadge score={c.avgLeadScore} />
          {c.hotLeads > 0 && (
            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-medium">
              {c.hotLeads} hot
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Mini label="Calls" value={c.totalCalls} />
        <Mini label="Booked" value={c.bookedAppointments} />
        <Mini label="Qualified" value={c.qualifiedLeads} />
        <Mini label="Missed recovered" value={c.missedCallRecoveries} />
        <Mini label="High-value" value={c.highValueLeads} />
        <Mini label="Compliance hits" value={c.complianceGateHits} />
      </div>
      {topActions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {topActions.map(([action, n]) => (
            <span
              key={action}
              className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono"
            >
              {action}: {n}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Last call: {lastLabel}</span>
        <span className="font-medium text-emerald-700">
          ${(c.estRevenueCents / 100).toFixed(0)} est.
        </span>
      </div>
    </div>
  )
}

function LeadScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 75
      ? 'bg-emerald-100 text-emerald-700'
      : score >= 50
        ? 'bg-blue-100 text-blue-700'
        : score >= 25
          ? 'bg-amber-100 text-amber-700'
          : 'bg-gray-100 text-gray-700'
  return (
    <span className={`px-2 py-0.5 rounded font-medium ${tone}`}>
      avg lead {score}
    </span>
  )
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-gray-50 dark:bg-gray-800 p-1.5">
      <div className="text-gray-500 text-[10px] uppercase tracking-wide">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}

const STATUS_TONE: Record<string, string> = {
  queued: 'bg-blue-100 text-blue-700',
  sent: 'bg-emerald-100 text-emerald-700',
  skipped: 'bg-gray-100 text-gray-600',
  failed: 'bg-rose-100 text-rose-700',
}

function FollowupActivity({ rows }: { rows: Followup[] }) {
  if (rows.length === 0) return null
  return (
    <section>
      <h2 className="font-medium mb-2">Recent follow-ups</h2>
      <p className="text-xs text-gray-500 mb-3">
        What the AI did after each call. Skipped rows show why (no phone, DNC, tenant disabled,
        etc.) — that&apos;s the audit story you can show your client.
      </p>
      <div className="border rounded divide-y dark:divide-gray-800 text-sm">
        {rows.map(r => (
          <div key={r.id} className="p-3 grid grid-cols-12 gap-2 items-start">
            <div className="col-span-3">
              <div className="font-medium truncate">{r.tenant_display_name}</div>
              <div className="text-xs text-gray-500 font-mono truncate">{r.pack_slug ?? '—'}</div>
            </div>
            <div className="col-span-2">
              <span
                className={`text-xs px-2 py-0.5 rounded font-mono ${STATUS_TONE[r.status] ?? ''}`}
              >
                {r.status}
              </span>
              {r.skip_reason && (
                <div className="text-[10px] text-gray-500 mt-1 font-mono">{r.skip_reason}</div>
              )}
            </div>
            <div className="col-span-2 text-xs">
              <div className="font-mono">{r.next_action}</div>
              {typeof r.lead_score === 'number' && (
                <div className="text-gray-500">score {r.lead_score}</div>
              )}
            </div>
            <div className="col-span-5 text-xs text-gray-700 dark:text-gray-300">
              {r.rendered_body ? (
                <div className="line-clamp-2">{r.rendered_body}</div>
              ) : (
                <div className="text-gray-400 italic">(no message — skipped)</div>
              )}
              <div className="text-[10px] text-gray-500 mt-0.5">
                {r.scheduled_for
                  ? `scheduled ${new Date(r.scheduled_for).toLocaleString()}`
                  : `created ${new Date(r.created_at).toLocaleString()}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

interface PreviewData {
  subject: string
  html: string
  text: string
  payload: any
}

function DigestModal({
  agencyId,
  tenantId,
  displayName,
  onClose,
}: {
  agencyId: string
  tenantId: string
  displayName: string
  onClose: () => void
}) {
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly')
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [recipient, setRecipient] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function loadPreview(freq: 'daily' | 'weekly') {
    setLoading(true)
    setSendResult(null)
    try {
      const res = await fetch(
        `/api/agencies/${encodeURIComponent(agencyId)}/digests/preview?tenantId=${encodeURIComponent(tenantId)}&frequency=${freq}`,
        { cache: 'no-store' },
      )
      const data = await res.json()
      if (!res.ok) {
        setPreview(null)
        setSendResult({ ok: false, msg: data.error ?? 'preview failed' })
        return
      }
      setPreview(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPreview(frequency)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frequency, tenantId])

  async function sendSample() {
    if (!recipient.trim()) return
    setSending(true)
    setSendResult(null)
    const res = await fetch(`/api/agencies/${encodeURIComponent(agencyId)}/digests/sample`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId, recipientEmail: recipient.trim(), frequency }),
    })
    const data = await res.json()
    if (!res.ok || data.status === 'failed' || data.status === 'skipped') {
      setSendResult({ ok: false, msg: data.error ?? data.status ?? 'send failed' })
    } else {
      setSendResult({ ok: true, msg: `Sent to ${recipient.trim()}.` })
    }
    setSending(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="font-medium">Owner digest preview — {displayName}</h3>
            <p className="text-xs text-gray-500">
              What this client&apos;s SMB owner gets emailed every {frequency}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={frequency}
              onChange={e => setFrequency(e.target.value as 'daily' | 'weekly')}
              className="text-sm px-2 py-1 border rounded"
            >
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
            <button onClick={onClose} className="text-sm px-3 py-1 border rounded">
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-sm text-gray-500">Loading preview…</div>
          ) : preview ? (
            <>
              <div className="text-xs text-gray-500 mb-2">Subject</div>
              <div className="font-medium mb-3">{preview.subject}</div>
              <iframe
                title="digest preview"
                srcDoc={preview.html}
                className="w-full border rounded bg-white"
                style={{ minHeight: 480 }}
              />
            </>
          ) : (
            <div className="text-sm text-gray-500">No data yet.</div>
          )}
        </div>
        <div className="p-4 border-t dark:border-gray-700 flex items-center gap-2">
          <input
            type="email"
            placeholder="Send a sample to (your email)"
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            className="flex-1 px-2 py-1 border rounded text-sm"
          />
          <button
            onClick={sendSample}
            disabled={sending || !recipient.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send sample'}
          </button>
          {sendResult && (
            <span
              className={`text-xs px-2 py-1 rounded ${
                sendResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {sendResult.msg}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

interface OwnerToken {
  id: string
  token: string
  recipient_email: string | null
  recipient_name: string | null
  label: string | null
  parent_id: string | null
  expires_at: string
  revoked_at: string | null
  allow_transcripts: boolean
  last_accessed_at: string | null
  access_count: number
  created_at: string
}

function OwnerLinkModal({
  agencyId,
  tenantId,
  displayName,
  onClose,
}: {
  agencyId: string
  tenantId: string
  displayName: string
  onClose: () => void
}) {
  const [tokens, setTokens] = useState<OwnerToken[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    recipientEmail: '',
    label: '',
    allowTranscripts: false,
  })

  async function refresh() {
    setLoading(true)
    const res = await fetch(
      `/api/agencies/${encodeURIComponent(agencyId)}/clients/${encodeURIComponent(tenantId)}/owner-token`,
      { cache: 'no-store' },
    )
    const data = await res.json()
    setTokens(data.tokens ?? [])
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  async function issue() {
    setBusy(true)
    await fetch(
      `/api/agencies/${encodeURIComponent(agencyId)}/clients/${encodeURIComponent(tenantId)}/owner-token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: form.recipientEmail || null,
          label: form.label || null,
          allowTranscripts: form.allowTranscripts,
        }),
      },
    )
    setForm({ recipientEmail: '', label: '', allowTranscripts: false })
    setBusy(false)
    refresh()
  }

  async function revoke(tokenId: string) {
    if (!confirm('Revoke this link? Anyone holding it will lose access (including any forwards).')) {
      return
    }
    setBusy(true)
    await fetch(
      `/api/agencies/${encodeURIComponent(agencyId)}/clients/${encodeURIComponent(tenantId)}/owner-token?tokenId=${encodeURIComponent(tokenId)}`,
      { method: 'DELETE' },
    )
    setBusy(false)
    refresh()
  }

  function urlFor(token: string) {
    return `${window.location.origin}/owner/${token}`
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => undefined)
  }

  const active = tokens.filter(
    t => !t.revoked_at && new Date(t.expires_at).getTime() > Date.now(),
  )
  const inactive = tokens.filter(
    t => !!t.revoked_at || new Date(t.expires_at).getTime() <= Date.now(),
  )

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="font-medium">Owner-portal links — {displayName}</h3>
            <p className="text-xs text-gray-500">
              Token-only access. Send the link to the SMB owner; revoke any time.
            </p>
          </div>
          <button onClick={onClose} className="text-sm px-3 py-1 border rounded">
            Close
          </button>
        </div>

        <div className="p-4 border-b dark:border-gray-700 space-y-2 bg-gray-50 dark:bg-gray-800">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Issue a new link
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              type="email"
              value={form.recipientEmail}
              onChange={e => setForm({ ...form, recipientEmail: e.target.value })}
              placeholder="recipient email (optional)"
              className="px-2 py-1 border rounded text-sm"
            />
            <input
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
              placeholder="label (e.g. owner, office manager)"
              className="px-2 py-1 border rounded text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={form.allowTranscripts}
              onChange={e => setForm({ ...form, allowTranscripts: e.target.checked })}
            />
            Allow this token to see redacted call summaries
            <span className="text-gray-400">(off by default — HIPAA / privilege caution)</span>
          </label>
          <button
            onClick={issue}
            disabled={busy}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Issue link'}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : active.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">
              No active links yet.
            </div>
          ) : (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                Active ({active.length})
              </div>
              <div className="space-y-2">
                {active.map(t => (
                  <div key={t.id} className="border rounded p-3 text-sm bg-white dark:bg-gray-900">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-medium">
                        {t.label ?? 'unlabelled'}{' '}
                        {t.parent_id && (
                          <span className="text-[10px] text-gray-500 font-normal">
                            (forwarded)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        expires {new Date(t.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {t.recipient_email ?? '— no recipient set —'}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        readOnly
                        value={urlFor(t.token)}
                        className="flex-1 px-2 py-1 border rounded text-xs font-mono bg-gray-50 dark:bg-gray-800"
                      />
                      <button
                        onClick={() => copy(urlFor(t.token))}
                        className="text-xs px-2 py-1 border rounded"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => revoke(t.id)}
                        className="text-xs px-2 py-1 border border-rose-300 text-rose-700 rounded"
                      >
                        Revoke
                      </button>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      {t.allow_transcripts ? 'transcripts allowed · ' : ''}
                      accessed {t.access_count}× ·{' '}
                      {t.last_accessed_at
                        ? `last ${new Date(t.last_accessed_at).toLocaleDateString()}`
                        : 'never'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <details>
              <summary className="text-xs text-gray-500 cursor-pointer">
                Revoked / expired ({inactive.length})
              </summary>
              <div className="space-y-1 mt-2">
                {inactive.map(t => (
                  <div
                    key={t.id}
                    className="text-xs text-gray-500 flex items-center justify-between border-b dark:border-gray-800 py-1"
                  >
                    <span>
                      {t.label ?? 'unlabelled'} · {t.recipient_email ?? '—'} ·{' '}
                      {t.revoked_at ? 'revoked' : 'expired'}
                    </span>
                    <span className="text-[10px]">
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
