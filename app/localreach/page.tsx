'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

// --- Types ---

interface CampaignSummary {
  id: string
  name: string
  niche: string
  status: 'active' | 'paused' | 'archived'
  calls_today: number
  daily_call_quota: number
}

interface CallFeedItem {
  id: string
  business_name: string
  outcome: 'answered' | 'voicemail' | 'booked' | 'paid' | 'no_answer'
  created_at: string
  campaign_id: string
}

interface DashboardStats {
  calls_today: number
  answered_rate: number
  booking_rate: number
  revenue_today: number
}

interface ScheduleDay {
  day: string
  short: string
  niches: string[]
  is_today: boolean
}

// --- Helpers ---

const OUTCOME_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  answered:   { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-400', label: 'Answered' },
  voicemail:  { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-400', label: 'Voicemail' },
  booked:     { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-400', label: 'Booked' },
  paid:       { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-400', label: 'Paid' },
  no_answer:  { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: 'No Answer' },
}

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  paused:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
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

// --- Skeleton Components ---

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 animate-pulse">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg mb-3" />
          <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  )
}

function CallFeedSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse">
          <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded ml-auto" />
          <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// --- Main Dashboard ---

export default function LocalReachDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [calls, setCalls] = useState<CallFeedItem[]>([])
  const [schedule, setSchedule] = useState<ScheduleDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPauseConfirm, setShowPauseConfirm] = useState(false)
  const [pauseLoading, setPauseLoading] = useState(false)
  const [hasActiveCalls, setHasActiveCalls] = useState(false)

  const fetchDashboard = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true)

      const [statsRes, campaignsRes, callsRes, scheduleRes] = await Promise.all([
        fetch('/api/localreach/stats'),
        fetch('/api/campaigns/localreach?limit=5'),
        fetch('/api/localreach/calls?limit=20'),
        fetch('/api/localreach/schedule'),
      ])

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }

      if (campaignsRes.ok) {
        const data = await campaignsRes.json()
        setCampaigns(Array.isArray(data) ? data : data.campaigns ?? [])
      }

      if (callsRes.ok) {
        const data = await callsRes.json()
        const callList = Array.isArray(data) ? data : data.calls ?? []
        setCalls(callList)
        setHasActiveCalls(callList.some((c: CallFeedItem) => {
          const age = Date.now() - new Date(c.created_at).getTime()
          return age < 120_000 && c.outcome === 'answered'
        }))
      }

      if (scheduleRes.ok) {
        const data = await scheduleRes.json()
        setSchedule(Array.isArray(data) ? data : data.schedule ?? [])
      }

      setError(null)
    } catch (err) {
      if (!isPolling) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      }
    } finally {
      if (!isPolling) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(() => fetchDashboard(true), 5000)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  async function handlePauseAll() {
    setPauseLoading(true)
    try {
      const res = await fetch('/api/localreach/pause-all', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to pause campaigns')
      setShowPauseConfirm(false)
      await fetchDashboard()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pause failed')
    } finally {
      setPauseLoading(false)
    }
  }

  async function handleTakeOver() {
    try {
      const res = await fetch('/api/localreach/takeover', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to take over call')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Take over failed')
    }
  }

  // Error state
  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Failed to Load Dashboard</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">{error}</p>
        <button
          onClick={() => fetchDashboard()}
          className="min-h-[44px] px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      {loading ? (
        <StatsSkeleton />
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            }
            value={stats.calls_today.toString()}
            label="Calls Today"
            color="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-50 dark:bg-blue-900/30"
          />
          <StatCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            value={`${stats.answered_rate}%`}
            label="Answered"
            color="text-green-600 dark:text-green-400"
            bgColor="bg-green-50 dark:bg-green-900/30"
          />
          <StatCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            value={`${stats.booking_rate}%`}
            label="Booking Rate"
            color="text-purple-600 dark:text-purple-400"
            bgColor="bg-purple-50 dark:bg-purple-900/30"
          />
          <StatCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            value={`$${stats.revenue_today.toLocaleString()}`}
            label="Revenue"
            color="text-yellow-600 dark:text-yellow-400"
            bgColor="bg-yellow-50 dark:bg-yellow-900/30"
          />
        </div>
      ) : null}

      {/* Active Campaigns */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Active Campaigns</h2>
          <Link
            href="/localreach/campaigns"
            className="min-h-[44px] flex items-center text-sm text-green-600 dark:text-green-400 font-medium hover:underline"
          >
            View all
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 animate-pulse">
                <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-8 border border-gray-200 dark:border-gray-800 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No campaigns yet</p>
            <Link
              href="/localreach/campaigns/new"
              className="min-h-[44px] inline-flex items-center px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors"
            >
              Create First Campaign
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/localreach/campaigns?selected=${campaign.id}`}
                className="block bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 hover:border-green-300 dark:hover:border-green-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{campaign.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{campaign.niche}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[campaign.status] ?? STATUS_STYLES.archived}`}>
                    {campaign.status}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>{campaign.calls_today} / {campaign.daily_call_quota} calls</span>
                    <span>{campaign.daily_call_quota > 0 ? Math.round((campaign.calls_today / campaign.daily_call_quota) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, campaign.daily_call_quota > 0 ? (campaign.calls_today / campaign.daily_call_quota) * 100 : 0)}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Call Feed */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Call Feed</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">Live — updates every 5s</span>
        </div>
        {loading ? (
          <CallFeedSkeleton />
        ) : calls.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-8 border border-gray-200 dark:border-gray-800 text-center">
            <p className="text-gray-500 dark:text-gray-400">No calls recorded yet. Start a campaign to begin dialing.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {calls.map((call) => {
              const style = OUTCOME_STYLES[call.outcome] ?? OUTCOME_STYLES.no_answer
              return (
                <div
                  key={call.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{call.business_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{timeAgo(call.created_at)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Weekly Schedule Strip */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Weekly Schedule</h2>
        {schedule.length > 0 ? (
          <div className="overflow-x-auto -mx-4 px-4 pb-2">
            <div className="flex gap-3 min-w-max">
              {schedule.map((day) => (
                <div
                  key={day.day}
                  className={`flex-shrink-0 w-28 rounded-xl p-3 border-2 transition-colors ${
                    day.is_today
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                  }`}
                >
                  <p className={`text-sm font-bold mb-1 ${day.is_today ? 'text-green-700 dark:text-green-400' : ''}`}>
                    {day.short}
                  </p>
                  {day.niches.length > 0 ? (
                    <div className="space-y-1">
                      {day.niches.map((niche) => (
                        <span
                          key={niche}
                          className="block text-xs text-gray-600 dark:text-gray-400 truncate"
                        >
                          {niche}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-600">Off</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : !loading ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 text-center text-sm text-gray-500 dark:text-gray-400">
            No schedule configured. Create a campaign to set niche schedules.
          </div>
        ) : null}
      </section>

      {/* Controls */}
      <section className="flex gap-3">
        {showPauseConfirm ? (
          <div className="flex-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-3">
              Pause all active campaigns? This will stop all outbound dialing immediately.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handlePauseAll}
                disabled={pauseLoading}
                className="min-h-[44px] flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors"
              >
                {pauseLoading ? 'Pausing...' : 'Confirm Pause All'}
              </button>
              <button
                onClick={() => setShowPauseConfirm(false)}
                className="min-h-[44px] px-4 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowPauseConfirm(true)}
              className="min-h-[44px] flex-1 px-4 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-xl font-semibold transition-colors"
            >
              Pause All
            </button>
            <button
              onClick={handleTakeOver}
              disabled={!hasActiveCalls}
              className="min-h-[44px] flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
            >
              Take Over Call
            </button>
          </>
        )}
      </section>

      {/* Error toast */}
      {error && stats && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto bg-red-600 text-white rounded-xl p-4 shadow-lg flex items-center justify-between z-50">
          <p className="text-sm">{error}</p>
          <button onClick={() => setError(null)} className="min-h-[44px] min-w-[44px] flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

// --- Stat Card ---

function StatCard({
  icon,
  value,
  label,
  color,
  bgColor,
}: {
  icon: React.ReactNode
  value: string
  label: string
  color: string
  bgColor: string
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
      <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}
