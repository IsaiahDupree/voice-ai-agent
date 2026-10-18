'use client'

/**
 * Agency settings — Sprint 5.2 (PRD §6 / UX-SPEC §4.3).
 *
 * v1.0 scope: Branding (logo URL + primary color + contact info) and
 * Billing (link out to Stripe portal). Team invites land in v1.x — see
 * UX-SPEC §4.3 + ROADMAP §M3.
 *
 * Branding propagates to:
 *   • Owner-digest email From line + brand band (lib/owner-digest.ts).
 *   • Future: client-facing portal (/owner/[token]).
 *
 * URL: /dashboard/agency/settings?id=<agencyId>
 */

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Agency {
  id: string
  slug: string
  name: string
  logo_url: string | null
  primary_color: string | null
  contact_email: string | null
  contact_phone: string | null
  plan: 'starter' | 'growth' | 'scale' | 'enterprise'
  max_clients: number
  status: 'active' | 'suspended' | 'archived'
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

const DEFAULT_AGENCY_ID = '00000000-0000-0000-0000-000000000001'

const TABS = ['Branding', 'Billing'] as const
type Tab = (typeof TABS)[number]

export default function AgencySettingsPage() {
  const params = useSearchParams()
  const agencyId = params.get('id') ?? DEFAULT_AGENCY_ID
  const [agency, setAgency] = useState<Agency | null>(null)
  const [tab, setTab] = useState<Tab>('Branding')

  async function refresh() {
    const res = await fetch(`/api/agencies/${encodeURIComponent(agencyId)}`, { cache: 'no-store' })
    const data = await res.json()
    setAgency(data.agency ?? null)
  }
  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId])

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agency settings</h1>
          <p className="text-sm text-gray-500">
            Branding propagates to every digest you send. Billing is managed via Stripe.
          </p>
        </div>
        <Link
          href={`/dashboard/agency?id=${encodeURIComponent(agencyId)}`}
          className="text-sm text-gray-500 hover:underline"
        >
          ← back to agency
        </Link>
      </header>

      {agency && (
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium">{agency.name}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">
            {agency.slug}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
            {agency.plan}
          </span>
        </div>
      )}

      <div className="flex gap-2 border-b dark:border-gray-700">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${
              tab === t
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {!agency ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : tab === 'Branding' ? (
        <BrandingTab agency={agency} onSaved={refresh} />
      ) : (
        <BillingTab agency={agency} agencyId={agencyId} />
      )}
    </div>
  )
}

// ─── Branding ────────────────────────────────────────────────────────

function BrandingTab({ agency, onSaved }: { agency: Agency; onSaved: () => void }) {
  const [name, setName] = useState(agency.name)
  const [logoUrl, setLogoUrl] = useState(agency.logo_url ?? '')
  const [primaryColor, setPrimaryColor] = useState(agency.primary_color ?? '#2563eb')
  const [contactEmail, setContactEmail] = useState(agency.contact_email ?? '')
  const [contactPhone, setContactPhone] = useState(agency.contact_phone ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function save() {
    setBusy(true)
    setMsg(null)
    const res = await fetch(`/api/agencies/${encodeURIComponent(agency.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        logo_url: logoUrl || null,
        primary_color: primaryColor,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
      }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setMsg({ kind: 'err', text: data.error ?? 'save failed' })
      return
    }
    setMsg({ kind: 'ok', text: 'Saved.' })
    onSaved()
  }

  const dirty =
    name !== agency.name ||
    (logoUrl || null) !== (agency.logo_url ?? null) ||
    primaryColor !== (agency.primary_color ?? '#2563eb') ||
    (contactEmail || null) !== (agency.contact_email ?? null) ||
    (contactPhone || null) !== (agency.contact_phone ?? null)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <label className="block text-sm">
          Agency display name
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded text-sm"
          />
        </label>
        <label className="block text-sm">
          Logo URL (https only — used in digest emails)
          <input
            value={logoUrl}
            onChange={e => setLogoUrl(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded text-sm font-mono"
            placeholder="https://cdn.example.com/logo.png"
          />
          <span className="text-[11px] text-gray-500">PNG/SVG, ≤ 1MB. Hosted somewhere stable.</span>
        </label>
        <label className="block text-sm">
          Primary color
          <div className="flex items-center gap-2 mt-1">
            <input
              type="color"
              value={primaryColor}
              onChange={e => setPrimaryColor(e.target.value)}
              className="w-12 h-9 border rounded cursor-pointer"
            />
            <input
              value={primaryColor}
              onChange={e => setPrimaryColor(e.target.value)}
              pattern="^#[0-9a-fA-F]{6}$"
              className="flex-1 px-3 py-2 border rounded text-sm font-mono"
            />
          </div>
        </label>
        <label className="block text-sm">
          Contact email (digest reply-to)
          <input
            type="email"
            value={contactEmail}
            onChange={e => setContactEmail(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded text-sm"
          />
        </label>
        <label className="block text-sm">
          Contact phone (optional)
          <input
            value={contactPhone}
            onChange={e => setContactPhone(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded text-sm font-mono"
          />
        </label>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={save}
            disabled={busy || !dirty}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save branding'}
          </button>
          {msg && (
            <span
              className={`text-xs px-2 py-1 rounded ${
                msg.kind === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {msg.text}
            </span>
          )}
        </div>
      </div>

      {/* Live preview — mirrors the digest header so the operator sees */}
      {/* what their client will receive. */}
      <DigestHeaderPreview
        name={name}
        logoUrl={logoUrl}
        primaryColor={primaryColor}
        contactEmail={contactEmail}
      />
    </div>
  )
}

function DigestHeaderPreview({
  name,
  logoUrl,
  primaryColor,
  contactEmail,
}: {
  name: string
  logoUrl: string
  primaryColor: string
  contactEmail: string
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Digest preview</div>
      <div className="border rounded overflow-hidden bg-white text-gray-900">
        <div
          style={{ borderBottom: `3px solid ${primaryColor}`, padding: 16 }}
        >
          {logoUrl && (
            <img
              src={logoUrl}
              alt={name}
              style={{ maxHeight: 36, display: 'block', marginBottom: 8 }}
            />
          )}
          <div style={{ fontSize: 18, fontWeight: 600 }}>Smith Roofing</div>
          <div style={{ color: '#666', fontSize: 12 }}>
            Last 7 days — prepared by {name || '—'}
          </div>
        </div>
        <div className="p-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-gray-100 rounded p-2">
            <div className="text-[10px] text-gray-500 uppercase">Calls</div>
            <div className="text-lg font-semibold">47</div>
          </div>
          <div className="bg-emerald-100 rounded p-2">
            <div className="text-[10px] text-emerald-700 uppercase">Booked</div>
            <div className="text-lg font-semibold text-emerald-700">12</div>
          </div>
          <div className="bg-blue-100 rounded p-2">
            <div className="text-[10px] text-blue-700 uppercase">Qualified</div>
            <div className="text-lg font-semibold text-blue-700">8</div>
          </div>
        </div>
        <div className="px-4 pb-4 text-[11px] text-gray-500 border-t pt-3">
          Prepared by {name || '—'}.
          {contactEmail && (
            <>
              {' '}Questions? Contact{' '}
              <span style={{ color: primaryColor }}>{contactEmail}</span>.
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Billing ─────────────────────────────────────────────────────────

function BillingTab({ agency, agencyId }: { agency: Agency; agencyId: string }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function openPortal() {
    setBusy(true)
    setErr(null)
    const res = await fetch(`/api/agencies/${encodeURIComponent(agencyId)}/billing-portal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok || !data.url) {
      setErr(data.error ?? 'portal_failed')
      return
    }
    window.location.href = data.url
  }

  const planLabel = useMemo(() => {
    const map: Record<string, { name: string; price: string; clients: number }> = {
      starter: { name: 'Starter', price: '$297/mo', clients: 5 },
      growth: { name: 'Growth', price: '$997/mo', clients: 25 },
      scale: { name: 'Scale', price: '$2,497/mo', clients: 50 },
      enterprise: { name: 'Enterprise', price: 'custom', clients: 1000 },
    }
    return map[agency.plan]
  }, [agency.plan])

  return (
    <div className="space-y-4 max-w-xl">
      <div className="border rounded p-4 space-y-2">
        <div className="text-xs text-gray-500 uppercase tracking-wide">Current plan</div>
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-semibold">{planLabel.name}</span>
          <span className="text-sm text-gray-600">{planLabel.price}</span>
        </div>
        <div className="text-xs text-gray-500">Up to {planLabel.clients} SMB clients</div>
      </div>

      <div className="border rounded p-4 space-y-3">
        <div>
          <div className="font-medium text-sm">Manage subscription</div>
          <p className="text-xs text-gray-500 mt-1">
            Stripe handles plan changes, payment method, invoices, and cancellation. You'll be
            redirected to a Stripe-hosted page and brought back here when you're done.
          </p>
        </div>
        <button
          onClick={openPortal}
          disabled={busy || !agency.stripe_customer_id}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
        >
          {busy ? 'Opening Stripe…' : 'Open billing portal →'}
        </button>
        {!agency.stripe_customer_id && (
          <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
            This agency was provisioned outside the signup flow and isn't linked to a Stripe
            customer yet. Contact support to attach billing.
          </div>
        )}
        {err && <div className="text-xs text-rose-700 bg-rose-50 p-2 rounded">{err}</div>}
      </div>

      {agency.status !== 'active' && (
        <div className="border border-amber-300 bg-amber-50 rounded p-4 text-sm text-amber-800">
          Your agency is currently <strong>{agency.status}</strong>. Restore via the billing
          portal or contact support.
        </div>
      )}
    </div>
  )
}
