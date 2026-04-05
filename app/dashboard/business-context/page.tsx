'use client'

import { useEffect, useState, useCallback } from 'react'

interface BusinessRow {
  id: string
  domain: string
  company_name: string | null
  status: string
  profile: Record<string, unknown> | null
  brief: string | null
  created_at: string
  updated_at: string
}

interface ContextDetail {
  brief: string
  key_facts: string[]
  pages_used: string[]
  unknowns: string[]
  confidence: string
  services_summary: string
  brand_tone: string
  ideal_customers: string
  booking_link: string | null
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  pending:    { label: 'Pending',    dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600 border-gray-200' },
  processing: { label: 'Crawling…', dot: 'bg-amber-400 animate-pulse', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  ready:      { label: 'Ready',     dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed:     { label: 'Failed',    dot: 'bg-red-400',     badge: 'bg-red-50 text-red-700 border-red-200' },
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high:   'text-emerald-600',
  medium: 'text-amber-600',
  low:    'text-red-500',
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function BusinessContextPage() {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [domain, setDomain] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<ContextDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [pollingId, setPollingId] = useState<string | null>(null)

  const fetchBusinesses = useCallback(async () => {
    try {
      const res = await fetch('/api/business-context/list')
      if (res.ok) {
        const data = await res.json()
        setBusinesses(data.businesses || [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBusinesses() }, [fetchBusinesses])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*/, '')
    if (!trimmed) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/business-context/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: trimmed }),
      })
      const data = await res.json()
      if (res.ok) {
        setDomain('')
        setPollingId(data.jobId)
        await fetchBusinesses()
        pollJob(data.jobId)
      }
    } catch {
      // handle error
    } finally {
      setSubmitting(false)
    }
  }

  const pollJob = async (jobId: string) => {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000))
      try {
        const res = await fetch(`/api/business-context/status?jobId=${jobId}`)
        const data = await res.json()
        if (data.status === 'ready' || data.status === 'failed') {
          setPollingId(null)
          fetchBusinesses()
          return
        }
        fetchBusinesses()
      } catch { break }
    }
    setPollingId(null)
    fetchBusinesses()
  }

  const toggleExpand = async (row: BusinessRow) => {
    if (expanded === row.id) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(row.id)
    setDetail(null)

    if (row.status !== 'ready') return

    setDetailLoading(true)
    try {
      const [fullRes, briefRes] = await Promise.all([
        fetch(`/api/business-context/full?domain=${row.domain}`),
        fetch(`/api/business-context?domain=${row.domain}`),
      ])
      const full = fullRes.ok ? await fullRes.json() : {}
      const brief = briefRes.ok ? await briefRes.json() : {}
      const profile = full.profile || {}

      setDetail({
        brief: brief.brief || full.brief || '',
        key_facts: brief.key_facts || [
          ...(profile.differentiators?.slice(0, 3) || []),
          ...(profile.metrics?.slice(0, 2) || []),
        ],
        pages_used: profile.pages_used || [],
        unknowns: profile.unknowns || [],
        confidence: profile.confidence || 'unknown',
        services_summary: brief.services_summary || (profile.services || []).join(', '),
        brand_tone: brief.brand_tone || (profile.brand_voice || []).join(', '),
        ideal_customers: brief.ideal_customers || profile.ideal_customers || '',
        booking_link: brief.booking_link || profile.booking_link || null,
      })
    } catch {
      // silently fail
    } finally {
      setDetailLoading(false)
    }
  }

  const readyCount = businesses.filter(b => b.status === 'ready').length
  const processingCount = businesses.filter(b => b.status === 'processing' || b.status === 'pending').length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🧠</span>
                <h1 className="text-xl font-bold text-gray-900">Business Context Engine</h1>
              </div>
              <p className="text-sm text-gray-500">
                Crawl any company website → extract a structured business profile → inject live context into Vapi AI agent calls
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Powered by Claude + GPT-4o
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Domains Indexed" value={readyCount} sub="ready for Vapi injection" />
          <StatCard label="In Progress" value={processingCount} sub="crawling now" />
          <StatCard label="Total Crawled" value={businesses.length} sub="all time" />
        </div>

        {/* Add Domain */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Add a Domain to Index</h2>
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">https://</span>
              <input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="acme.com"
                className="w-full pl-16 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={submitting}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !domain.trim()}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Queuing…
                </span>
              ) : 'Start Crawl'}
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-2">
            Crawls up to 25 pages · respects robots.txt · ~15–30s per domain
          </p>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Indexed Businesses</h2>
            <button
              onClick={fetchBusinesses}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : businesses.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-gray-400 text-sm">No businesses indexed yet.</p>
              <p className="text-gray-300 text-xs mt-1">Add a domain above to get started.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Domain</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Company</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Confidence</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Crawled</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {businesses.map(row => (
                  <>
                    <tr
                      key={row.id}
                      onClick={() => toggleExpand(row)}
                      className={`cursor-pointer transition-colors ${expanded === row.id ? 'bg-blue-50/50' : 'hover:bg-gray-50/80'}`}
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                          {row.domain}
                        </span>
                        {pollingId && row.status === 'processing' && (
                          <span className="ml-2 text-xs text-amber-500 animate-pulse">crawling…</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-800">{row.company_name || <span className="text-gray-300">—</span>}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={row.status} /></td>
                      <td className="px-5 py-3.5">
                        {row.profile ? (
                          <span className={`font-medium capitalize ${CONFIDENCE_COLORS[(row.profile as Record<string, string>).confidence] || 'text-gray-400'}`}>
                            {(row.profile as Record<string, string>).confidence || '—'}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">
                        {new Date(row.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`text-gray-400 text-xs transition-transform inline-block ${expanded === row.id ? 'rotate-180' : ''}`}>▾</span>
                      </td>
                    </tr>

                    {/* Expanded detail panel */}
                    {expanded === row.id && (
                      <tr key={`${row.id}-detail`}>
                        <td colSpan={6} className="p-0">
                          <div className="px-6 py-5 bg-blue-50/30 border-t border-blue-100">
                            {detailLoading ? (
                              <p className="text-sm text-gray-400 animate-pulse">Loading profile…</p>
                            ) : detail ? (
                              <div className="grid grid-cols-3 gap-6">
                                {/* Brief */}
                                <div className="col-span-2 space-y-4">
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">AI-Generated Brief</p>
                                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed bg-white rounded-lg border border-gray-200 p-4">
                                      {detail.brief}
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Services</p>
                                      <p className="text-sm text-gray-700">{detail.services_summary || '—'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Brand Voice</p>
                                      <p className="text-sm text-gray-700">{detail.brand_tone || '—'}</p>
                                    </div>
                                  </div>
                                  {detail.ideal_customers && (
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ideal Customer</p>
                                      <p className="text-sm text-gray-700">{detail.ideal_customers}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Side panel */}
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Facts for Vapi</p>
                                    <ul className="space-y-1.5">
                                      {detail.key_facts.map((f, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                          <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                                          {f}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-gray-500">Pages crawled</span>
                                      <span className="font-medium text-gray-700">{detail.pages_used.length}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-gray-500">Confidence</span>
                                      <span className={`font-medium capitalize ${CONFIDENCE_COLORS[detail.confidence] || 'text-gray-500'}`}>
                                        {detail.confidence}
                                      </span>
                                    </div>
                                    {detail.booking_link && (
                                      <div className="pt-1 border-t border-gray-100">
                                        <a
                                          href={detail.booking_link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-blue-600 hover:underline truncate block"
                                          onClick={e => e.stopPropagation()}
                                        >
                                          📅 Booking link detected
                                        </a>
                                      </div>
                                    )}
                                  </div>

                                  {detail.unknowns.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Unknowns</p>
                                      <ul className="space-y-1">
                                        {detail.unknowns.slice(0, 3).map((u, i) => (
                                          <li key={i} className="text-xs text-gray-400">{u}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  <div className="pt-2">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Vapi Injection</p>
                                    <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-emerald-400 overflow-x-auto">
                                      {`assistantOverrides.variableValues`}<br />
                                      {`  ↳ company_name`}<br />
                                      {`  ↳ business_brief`}<br />
                                      {`  ↳ services`}<br />
                                      {`  ↳ booking_link`}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400">
                                {row.status === 'ready' ? 'Failed to load profile.' : 'Profile will appear here once crawl completes.'}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* How it works */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">How It Works</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { step: '01', icon: '🌐', title: 'Crawl', desc: 'Custom Node.js crawler maps all links, scores by priority (home, about, services), fetches top 25 pages' },
              { step: '02', icon: '🤖', title: 'Extract', desc: 'Claude / GPT-4o reads the full page corpus and extracts a structured BusinessProfile JSON' },
              { step: '03', icon: '💾', title: 'Store', desc: 'Profile + compressed 600-word brief stored in Supabase, cached for 1 hour' },
              { step: '04', icon: '📞', title: 'Inject', desc: 'Vapi agent calls receive assistantOverrides with company context before the call starts' },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="relative">
                <div className="text-xs font-mono text-gray-300 mb-2">{step}</div>
                <div className="text-xl mb-2">{icon}</div>
                <p className="text-sm font-semibold text-gray-700 mb-1">{title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
