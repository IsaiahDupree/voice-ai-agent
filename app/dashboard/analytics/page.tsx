'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Download, RefreshCw } from 'lucide-react'

interface AnalyticsSummary {
  totalCalls: number
  avgDuration: number
  goalAchievedRate: number
  bookings: number
  callsPerDay: { date: string; count: number }[]
  bookingsPerDay: { date: string; count: number }[]
  outcomeDistribution: { outcome: string; count: number; percentage: number }[]
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState('30d')

  async function fetchAnalytics() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics?range=${range}`)
      if (!res.ok) throw new Error('Failed to fetch analytics')
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [range])

  function exportCsv() {
    window.location.href = `/api/analytics?format=csv&range=${range}`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="w-8 h-8" />
          Analytics
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3 py-2 rounded border bg-background text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded border bg-background text-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 rounded border bg-background text-sm hover:bg-muted"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase mb-1">Total Calls</p>
              <p className="text-3xl font-bold">{data.totalCalls ?? '—'}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase mb-1">Avg Duration</p>
              <p className="text-3xl font-bold">{data.avgDuration != null ? `${data.avgDuration}s` : '—'}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase mb-1">Goal Rate</p>
              <p className="text-3xl font-bold">
                {data.goalAchievedRate != null ? `${(data.goalAchievedRate * 100).toFixed(1)}%` : '—'}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase mb-1">Bookings</p>
              <p className="text-3xl font-bold">{data.bookings ?? '—'}</p>
            </div>
          </div>

          {/* Outcome distribution */}
          {data.outcomeDistribution?.length > 0 && (
            <div className="rounded-lg border bg-card p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Outcome Distribution</h2>
              <div className="space-y-3">
                {data.outcomeDistribution.map((item) => (
                  <div key={item.outcome} className="flex items-center gap-3">
                    <span className="w-32 text-sm text-muted-foreground capitalize">{item.outcome.replace(/_/g, ' ')}</span>
                    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">{item.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calls per day table */}
          {data.callsPerDay?.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Calls per Day</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Calls</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Bookings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.callsPerDay.map((row, i) => {
                      const bookings = data.bookingsPerDay?.[i]?.count ?? 0
                      return (
                        <tr key={row.date} className="hover:bg-muted transition-colors">
                          <td className="px-4 py-2">{row.date}</td>
                          <td className="px-4 py-2 text-right font-medium">{row.count}</td>
                          <td className="px-4 py-2 text-right">{bookings}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">No analytics data available</p>
        </div>
      )}
    </div>
  )
}
