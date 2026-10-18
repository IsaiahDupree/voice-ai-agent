'use client'

/**
 * /owner/[token] — SMB owner portal (Sprint 6 / UX-SPEC §3.5, §4.9).
 *
 * Token-authenticated read-only view. The token IS the credential —
 * no login. Three sections:
 *   1. This week — same numbers as the digest, interactive.
 *   2. Recent calls — last 20 calls (summary + score + next action).
 *      Transcripts only when the agency unlocked them on this token.
 *   3. Highlights — top 3 calls by lead_score / high-value outcome.
 *
 * White-labeled with the agency's brand. Owner can:
 *   • Forward the link to a teammate (spawns a child token under same parent).
 *   • Talk to the agency (mailto link).
 *
 * On token failure (invalid / expired / revoked), the page never
 * reveals which — single "ask your agency for a new link" state.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface OwnerData {
  tenantName: string
  packSlug: string | null
  agency: {
    name: string
    logo_url: string | null
    primary_color: string | null
    contact_email: string | null
    contact_phone: string | null
  } | null
  periodStart: string
  periodEnd: string
  totalCalls: number
  bookedAppointments: number
  qualifiedLeads: number
  hotLeads: number
  missedCallRecoveries: number
  estRevenueCents: number
  highlights: CallSummary[]
  recentCalls: CallSummary[]
  allowTranscripts: boolean
}

interface CallSummary {
  callId: string
  startedAt: string
  durationSec: number | null
  outcome: string | null
  leadScore: number | null
  nextAction: string | null
  redactedSummary: string | null
}

const TABS = ['This week', 'Recent calls', 'Highlights'] as const
type Tab = (typeof TABS)[number]

const HUMAN_OUTCOMES: Record<string, string> = {
  booked: 'Appointment booked',
  test_drive_booked: 'Test drive booked',
  service_booked: 'Service appointment booked',
  qualified_lead: 'Qualified lead captured',
  soa_captured: 'Medicare SOA captured',
  missed_call_recovered: 'Missed call recovered',
  finance_handoff: 'Finance handoff',
  appraisal_handoff: 'Trade-in appraisal handoff',
  transferred: 'Transferred to your team',
  insurance_verified: 'Insurance verified',
  refill_requested: 'Refill requested',
  coi_issued: 'COI issued',
}

export default function OwnerPortalPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token ?? '')

  const [data, setData] = useState<OwnerData | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ok' | 'error'>('loading')
  const [tab, setTab] = useState<Tab>('This week')
  const [forwardOpen, setForwardOpen] = useState(false)

  useEffect(() => {
    if (!token) {
      setPhase('error')
      return
    }
    let cancelled = false
    fetch(`/api/owner/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        if (!json.ok) {
          setPhase('error')
          return
        }
        setData(json.data)
        setPhase('ok')
      })
      .catch(() => !cancelled && setPhase('error'))
    return () => {
      cancelled = true
    }
  }, [token])

  if (phase === 'loading') {
    return (
      <div className="max-w-3xl mx-auto p-6 mt-16 text-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    )
  }
  if (phase === 'error' || !data) {
    return <PortalError />
  }

  const accent = data.agency?.primary_color ?? '#2563eb'
  const agencyName = data.agency?.name ?? data.tenantName

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* White-label header */}
      <header
        className="border-b"
        style={{ borderBottomColor: accent, borderBottomWidth: 3 }}
      >
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          {data.agency?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.agency.logo_url}
              alt={agencyName}
              style={{ maxHeight: 36 }}
              className="block"
            />
          )}
          <div>
            <h1 className="text-lg font-semibold">{data.tenantName}</h1>
            <p className="text-xs text-gray-500">prepared by {agencyName}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 border-b dark:border-gray-700">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px ${
                tab === t
                  ? 'font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              style={tab === t ? { borderBottomColor: accent, color: accent } : undefined}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'This week' && <ThisWeek data={data} accent={accent} />}
        {tab === 'Recent calls' && <RecentCalls data={data} />}
        {tab === 'Highlights' && <Highlights data={data} />}

        {/* Footer: forward + agency contact */}
        <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <div className="font-medium">Want to share this with your team?</div>
              <p className="text-xs text-gray-500">
                We'll generate a fresh link they can use to view the same data.
              </p>
            </div>
            <button
              onClick={() => setForwardOpen(true)}
              className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Forward to my team
            </button>
          </div>
          {data.agency?.contact_email && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t dark:border-gray-700">
              <div className="text-sm">
                <div className="font-medium">Want changes? Talk to {agencyName}.</div>
                <p className="text-xs text-gray-500">
                  Pricing, scripts, scheduling, integrations — your agency makes those calls.
                </p>
              </div>
              <a
                href={`mailto:${data.agency.contact_email}?subject=${encodeURIComponent(`${data.tenantName} — AI receptionist`)}`}
                className="px-3 py-1.5 rounded text-sm text-white"
                style={{ background: accent }}
              >
                Email {agencyName}
              </a>
            </div>
          )}
        </div>

        {forwardOpen && (
          <ForwardModal token={token} onClose={() => setForwardOpen(false)} />
        )}

        <div className="text-[11px] text-gray-400 text-center">
          This is a private link from {agencyName}. Don't share publicly.
        </div>
      </main>
    </div>
  )
}

function ThisWeek({ data, accent }: { data: OwnerData; accent: string }) {
  return (
    <section className="space-y-3">
      <div className="text-xs text-gray-500">
        Last {Math.round((new Date(data.periodEnd).getTime() - new Date(data.periodStart).getTime()) / 86400000)}{' '}
        days
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Tile label="Calls" value={data.totalCalls} />
        <Tile label="Booked" value={data.bookedAppointments} accentBg="#dcfce7" accentText="#15803d" />
        <Tile label="Qualified" value={data.qualifiedLeads} accentBg="#dbeafe" accentText="#1d4ed8" />
        <Tile label="Hot leads" value={data.hotLeads} accentBg="#fee2e2" accentText="#b91c1c" />
        <Tile label="Missed recovered" value={data.missedCallRecoveries} accentBg="#fef3c7" accentText="#a16207" />
        <Tile
          label="Est. revenue"
          value={`$${(data.estRevenueCents / 100).toFixed(0)}`}
          accentBg="#dcfce7"
          accentText="#15803d"
        />
      </div>
    </section>
  )
}

function RecentCalls({ data }: { data: OwnerData }) {
  if (data.recentCalls.length === 0) {
    return <div className="text-sm text-gray-500 p-6 text-center">No calls yet in this window.</div>
  }
  return (
    <section className="space-y-2">
      {data.recentCalls.map(c => (
        <CallRow key={c.callId} c={c} allowTranscripts={data.allowTranscripts} />
      ))}
    </section>
  )
}

function Highlights({ data }: { data: OwnerData }) {
  if (data.highlights.length === 0) {
    return (
      <div className="text-sm text-gray-500 p-6 text-center">
        No highlight-worthy calls this week. Check back as the AI handles more calls.
      </div>
    )
  }
  return (
    <section className="space-y-2">
      {data.highlights.map((c, i) => (
        <div key={c.callId} className="border rounded-lg p-3 bg-white dark:bg-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-gray-500">#{i + 1}</div>
              <div className="font-medium text-sm">
                {c.outcome ? HUMAN_OUTCOMES[c.outcome] ?? c.outcome : '—'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(c.startedAt).toLocaleString()}
              </div>
              {c.redactedSummary && (
                <p className="text-sm mt-2 text-gray-700 dark:text-gray-300">
                  {c.redactedSummary}
                </p>
              )}
            </div>
            {typeof c.leadScore === 'number' && (
              <ScoreBadge score={c.leadScore} />
            )}
          </div>
        </div>
      ))}
    </section>
  )
}

function CallRow({
  c,
  allowTranscripts,
}: {
  c: CallSummary
  allowTranscripts: boolean
}) {
  return (
    <div className="border rounded-lg p-3 bg-white dark:bg-gray-800 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {c.outcome ? HUMAN_OUTCOMES[c.outcome] ?? c.outcome : '—'}
          </span>
          {c.nextAction && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
              {c.nextAction}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {new Date(c.startedAt).toLocaleString()}
        </div>
        {allowTranscripts && c.redactedSummary && (
          <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">
            {c.redactedSummary}
          </p>
        )}
      </div>
      {typeof c.leadScore === 'number' && <ScoreBadge score={c.leadScore} />}
    </div>
  )
}

function Tile({
  label,
  value,
  accentBg,
  accentText,
}: {
  label: string
  value: string | number
  accentBg?: string
  accentText?: string
}) {
  return (
    <div
      className="rounded-lg p-3 border"
      style={accentBg ? { background: accentBg, borderColor: 'transparent' } : undefined}
    >
      <div
        className="text-[11px] uppercase tracking-wide"
        style={{ color: accentText ?? '#666' }}
      >
        {label}
      </div>
      <div
        className="text-2xl font-semibold tabular-nums"
        style={{ color: accentText ?? undefined }}
      >
        {value}
      </div>
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 75
      ? { bg: '#dcfce7', text: '#15803d' }
      : score >= 50
        ? { bg: '#dbeafe', text: '#1d4ed8' }
        : score >= 25
          ? { bg: '#fef3c7', text: '#a16207' }
          : { bg: '#f3f4f6', text: '#4b5563' }
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded shrink-0"
      style={{ background: tone.bg, color: tone.text }}
    >
      score {score}
    </span>
  )
}

function PortalError() {
  return (
    <div className="max-w-md mx-auto p-6 mt-16 text-center space-y-3">
      <h1 className="text-xl font-semibold">Link unavailable</h1>
      <p className="text-sm text-gray-600">
        This link is invalid, expired, or has been revoked. Please ask your agency for a new
        link.
      </p>
    </div>
  )
}

function ForwardModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<
    | { kind: 'idle' }
    | { kind: 'ok'; url: string }
    | { kind: 'err'; msg: string }
  >({ kind: 'idle' })

  async function generate() {
    setBusy(true)
    setResult({ kind: 'idle' })
    const res = await fetch(`/api/owner/${encodeURIComponent(token)}/forward`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipientEmail: email || null }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setResult({ kind: 'err', msg: data.error ?? 'failed' })
      return
    }
    const url = `${window.location.origin}/owner/${data.token}`
    setResult({ kind: 'ok', url })
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      /* user can copy manually */
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-5 w-full max-w-md space-y-3">
        <h3 className="font-medium">Forward to your team</h3>
        <p className="text-xs text-gray-500">
          We'll generate a fresh link with the same access. Optional: email to track who you
          shared it with.
        </p>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="teammate@yourcompany.com (optional)"
          className="w-full px-3 py-2 border rounded text-sm"
        />
        {result.kind === 'ok' && (
          <div className="space-y-2">
            <input
              readOnly
              value={result.url}
              className="w-full px-2 py-1 border rounded text-xs font-mono bg-gray-50 dark:bg-gray-800"
            />
            <button
              onClick={() => copy(result.url)}
              className="text-xs text-blue-600 hover:underline"
            >
              Copy link
            </button>
          </div>
        )}
        {result.kind === 'err' && (
          <div className="text-xs text-rose-700 bg-rose-50 p-2 rounded">{result.msg}</div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 border rounded text-sm">
            Done
          </button>
          {result.kind !== 'ok' && (
            <button
              onClick={generate}
              disabled={busy}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
            >
              {busy ? 'Generating…' : 'Generate link'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
