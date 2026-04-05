'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Campaign {
  id: string
  name: string
  niche: string
  offer_name: string
  status: 'active' | 'paused' | 'archived'
  calls_today: number
  daily_call_quota: number
  center_lat: number
  center_lng: number
  radius_miles: number
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  paused:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const STATUS_FILTER_OPTIONS = ['all', 'active', 'paused', 'archived'] as const

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchCampaigns()
  }, [])

  async function fetchCampaigns() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/campaigns/localreach')
      if (!res.ok) throw new Error(`Failed to load campaigns: ${res.statusText}`)
      const data = await res.json()
      setCampaigns(Array.isArray(data) ? data : data.campaigns ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  const filtered = statusFilter === 'all'
    ? campaigns
    : campaigns.filter((c) => c.status === statusFilter)

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={fetchCampaigns}
          className="min-h-[44px] px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Campaigns</h1>
        <Link
          href="/localreach/campaigns/new"
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Campaign
        </Link>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTER_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`min-h-[44px] px-4 py-2 rounded-full text-sm font-medium capitalize whitespace-nowrap transition-colors ${
              statusFilter === s
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {s === 'all' ? `All (${campaigns.length})` : `${s} (${campaigns.filter(c => c.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Campaign Cards */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 animate-pulse">
              <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
              <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 border border-gray-200 dark:border-gray-800 text-center">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {statusFilter === 'all' ? 'No campaigns created yet' : `No ${statusFilter} campaigns`}
          </p>
          {statusFilter === 'all' && (
            <Link
              href="/localreach/campaigns/new"
              className="min-h-[44px] inline-flex items-center px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors"
            >
              Create First Campaign
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 hover:border-green-300 dark:hover:border-green-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{campaign.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{campaign.niche}</p>
                </div>
                <span className={`shrink-0 ml-3 text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[campaign.status] ?? STATUS_STYLES.archived}`}>
                  {campaign.status}
                </span>
              </div>

              {campaign.offer_name && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Offer: <span className="font-medium">{campaign.offer_name}</span>
                </p>
              )}

              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>{campaign.calls_today} / {campaign.daily_call_quota} calls today</span>
                  <span>{campaign.daily_call_quota > 0 ? Math.round((campaign.calls_today / campaign.daily_call_quota) * 100) : 0}%</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, campaign.daily_call_quota > 0 ? (campaign.calls_today / campaign.daily_call_quota) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
