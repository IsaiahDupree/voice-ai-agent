'use client'

/**
 * Agency signup — Sprint 4.3 (PRD §6.4).
 *
 * Picks a plan, captures agency name + slug + contact email, kicks off
 * a Stripe Checkout Session. The agency record is created by the
 * webhook only after payment lands — we never create an agency for a
 * customer who didn't actually pay.
 */

import { useState, useMemo } from 'react'

interface PlanCard {
  plan: 'starter' | 'growth' | 'scale'
  name: string
  monthlyUsd: number
  maxClients: number
  highlight?: string
}

const PLANS: PlanCard[] = [
  {
    plan: 'starter',
    name: 'Starter',
    monthlyUsd: 297,
    maxClients: 5,
    highlight: 'For agencies onboarding their first SMBs.',
  },
  {
    plan: 'growth',
    name: 'Growth',
    monthlyUsd: 997,
    maxClients: 25,
    highlight: 'Most agencies live here.',
  },
  {
    plan: 'scale',
    name: 'Scale',
    monthlyUsd: 2497,
    maxClients: 50,
    highlight: 'Multi-rep operations.',
  },
]

export default function SignupPage() {
  const [agencyName, setAgencyName] = useState('')
  const [agencySlug, setAgencySlug] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [plan, setPlan] = useState<'starter' | 'growth' | 'scale'>('growth')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slugPreview = useMemo(() => {
    if (agencySlug) return agencySlug
    return agencyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
  }, [agencyName, agencySlug])

  async function checkout() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/agencies/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agencyName: agencyName.trim(),
        agencySlug: (agencySlug || slugPreview).trim(),
        contactEmail: contactEmail.trim(),
        plan,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'signup failed')
      setLoading(false)
      return
    }
    window.location.href = data.url
  }

  const valid = agencyName.trim() && (agencySlug.trim() || slugPreview) && contactEmail.includes('@')

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Start your agency</h1>
        <p className="text-gray-600 text-sm">
          24/7 AI receptionists for your SMB clients — answer every call, recover missed leads,
          follow up automatically, prove ROI monthly. You manage everything from one dashboard.
        </p>
      </header>

      <section>
        <h2 className="font-medium mb-3">Pick a plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PLANS.map(p => {
            const selected = plan === p.plan
            return (
              <button
                key={p.plan}
                onClick={() => setPlan(p.plan)}
                className={`text-left p-4 border-2 rounded transition ${
                  selected
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm text-gray-500">${p.monthlyUsd}/mo</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">Up to {p.maxClients} SMB clients</div>
                {p.highlight && (
                  <div className="text-xs text-gray-600 mt-2 italic">{p.highlight}</div>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">About your agency</h2>
        <label className="block text-sm">
          Agency name
          <input
            value={agencyName}
            onChange={e => setAgencyName(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded text-sm"
            placeholder="Rocket Marketing Agency"
          />
        </label>
        <label className="block text-sm">
          URL slug
          <div className="flex items-center gap-2 mt-1">
            <input
              value={agencySlug || slugPreview}
              onChange={e => setAgencySlug(e.target.value)}
              className="flex-1 px-3 py-2 border rounded text-sm font-mono"
              placeholder="rocket-marketing"
            />
            <span className="text-xs text-gray-500">/{slugPreview || 'your-slug'}</span>
          </div>
        </label>
        <label className="block text-sm">
          Contact email (Stripe receipt + login)
          <input
            type="email"
            value={contactEmail}
            onChange={e => setContactEmail(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded text-sm"
            placeholder="hi@rocket.test"
          />
        </label>
      </section>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      <button
        onClick={checkout}
        disabled={!valid || loading}
        className="px-5 py-2.5 bg-blue-600 text-white rounded font-medium disabled:opacity-50"
      >
        {loading ? 'Redirecting to Stripe…' : 'Continue to checkout →'}
      </button>

      <p className="text-xs text-gray-500">
        Stripe handles payment. Your agency record is created automatically once payment is
        confirmed; no agency is provisioned for a failed payment.
      </p>
    </div>
  )
}
