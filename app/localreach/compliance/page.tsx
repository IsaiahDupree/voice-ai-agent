'use client'

import { useEffect, useState } from 'react'

interface ComplianceEvent {
  id: string
  type: 'dnc_check' | 'consent_recorded' | 'opt_out' | 'time_violation' | 'suppression_added'
  phone: string
  message: string
  created_at: string
  severity: 'info' | 'warning' | 'error'
}

interface ComplianceStats {
  suppression_count: number
  dnc_checks_today: number
  opt_outs_today: number
  violations_today: number
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  info:    { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  warning: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  error:   { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  return phone
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function CompliancePage() {
  const [events, setEvents] = useState<ComplianceEvent[]>([])
  const [stats, setStats] = useState<ComplianceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Phone check form
  const [checkPhone, setCheckPhone] = useState('')
  const [checkResult, setCheckResult] = useState<{ status: string; message: string } | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    fetchCompliance()
  }, [])

  async function fetchCompliance() {
    setLoading(true)
    setError(null)
    try {
      const [eventsRes, statsRes] = await Promise.all([
        fetch('/api/localreach/compliance/events?limit=50'),
        fetch('/api/localreach/compliance/stats'),
      ])

      if (eventsRes.ok) {
        const data = await eventsRes.json()
        setEvents(Array.isArray(data) ? data : data.events ?? [])
      }

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load compliance data')
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckPhone(e: React.FormEvent) {
    e.preventDefault()
    if (!checkPhone.trim()) return

    setChecking(true)
    setCheckResult(null)
    try {
      const res = await fetch('/api/localreach/compliance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: checkPhone.trim() }),
      })
      const data = await res.json()
      setCheckResult({
        status: data.blocked ? 'blocked' : 'clear',
        message: data.blocked
          ? `This number is on the suppression list: ${data.reason ?? 'Do Not Call'}`
          : 'This number is clear to call.',
      })
    } catch {
      setCheckResult({ status: 'error', message: 'Failed to check number. Try again.' })
    } finally {
      setChecking(false)
    }
  }

  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={fetchCompliance}
          className="min-h-[44px] px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Compliance Dashboard</h1>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 animate-pulse">
              <div className="h-7 w-12 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.suppression_count.toLocaleString()}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Suppressed Numbers</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.dnc_checks_today}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">DNC Checks Today</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.opt_outs_today}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Opt-Outs Today</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.violations_today}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Violations Today</p>
          </div>
        </div>
      ) : null}

      {/* Phone Check Form */}
      <section className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
        <h2 className="text-base font-semibold mb-3">Check Phone Number</h2>
        <form onSubmit={handleCheckPhone} className="flex gap-3">
          <input
            type="tel"
            value={checkPhone}
            onChange={(e) => {
              setCheckPhone(e.target.value)
              setCheckResult(null)
            }}
            placeholder="(555) 123-4567"
            className="flex-1 min-h-[44px] px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={checking || !checkPhone.trim()}
            className="min-h-[44px] min-w-[44px] px-5 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
          >
            {checking ? (
              <svg className="animate-spin h-5 w-5 mx-auto" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              'Check'
            )}
          </button>
        </form>
        {checkResult && (
          <div className={`mt-3 p-3 rounded-xl text-sm font-medium ${
            checkResult.status === 'clear'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : checkResult.status === 'blocked'
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
          }`}>
            {checkResult.message}
          </div>
        )}
      </section>

      {/* Recent Events */}
      <section>
        <h2 className="text-base font-semibold mb-3">Recent Events</h2>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 animate-pulse">
                <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-8 border border-gray-200 dark:border-gray-800 text-center">
            <p className="text-gray-500 dark:text-gray-400">No compliance events recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {events.map((event) => {
              const style = SEVERITY_STYLES[event.severity] ?? SEVERITY_STYLES.info
              return (
                <div
                  key={event.id}
                  className={`rounded-xl p-4 border border-gray-200 dark:border-gray-800 ${style.bg}`}
                >
                  <div className="flex items-start gap-3">
                    <svg className={`w-5 h-5 shrink-0 mt-0.5 ${style.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={style.icon} />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${style.text}`}>{event.message}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatPhone(event.phone)}</span>
                        <span>{timeAgo(event.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
