// F0331: Booking analytics chart component

'use client'

import { useEffect, useState } from 'react'

interface BookingDataPoint {
  date: string
  count: number
  confirmed: number
  cancelled: number
  rescheduled: number
  completed: number
}

interface AnalyticsSummary {
  total: number
  avgPerDay: number
  peakDay: {
    date: string
    count: number
  }
  dateRange: {
    start: string
    end: string
  }
}

export default function BookingAnalytics({ days = 30 }: { days?: number }) {
  const [data, setData] = useState<BookingDataPoint[]>([])
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAnalytics()
  }, [days])

  async function loadAnalytics() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics/bookings?days=${days}`)
      if (!res.ok) {
        throw new Error('Failed to load analytics')
      }

      const result = await res.json()
      setData(result.data || [])
      setSummary(result.summary)
    } catch (err: any) {
      setError(err.message)
      console.error('Error loading booking analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-2xl font-semibold mb-4">Booking Analytics</h2>
        <div className="text-center py-8 text-gray-400">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-2xl font-semibold mb-4">Booking Analytics</h2>
        <div className="text-center py-8 text-red-400">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-2xl font-semibold mb-4">Booking Analytics</h2>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-700 rounded p-4">
            <div className="text-gray-400 text-sm">Total Bookings</div>
            <div className="text-3xl font-bold text-blue-400">{summary.total}</div>
          </div>
          <div className="bg-gray-700 rounded p-4">
            <div className="text-gray-400 text-sm">Avg Per Day</div>
            <div className="text-3xl font-bold text-green-400">{summary.avgPerDay}</div>
          </div>
          <div className="bg-gray-700 rounded p-4">
            <div className="text-gray-400 text-sm">Peak Day</div>
            <div className="text-xl font-bold text-purple-400">{summary.peakDay.count}</div>
            <div className="text-xs text-gray-500">{summary.peakDay.date}</div>
          </div>
        </div>
      )}

      {/* Bar Chart */}
      <div className="space-y-1">
        <div className="text-sm text-gray-400 mb-2">Bookings per day (last {days} days)</div>
        {data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No bookings in this period</div>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {data.map((point) => (
              <div key={point.date} className="flex items-center gap-2">
                <div className="text-xs text-gray-500 w-20">
                  {new Date(point.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                <div className="flex-1 flex items-center gap-1">
                  {/* Confirmed */}
                  {point.confirmed > 0 && (
                    <div
                      className="bg-green-500 h-6 rounded flex items-center justify-center text-xs text-white"
                      style={{
                        width: `${(point.confirmed / maxCount) * 100}%`,
                        minWidth: '20px'
                      }}
                      title={`${point.confirmed} confirmed`}
                    >
                      {point.confirmed}
                    </div>
                  )}
                  {/* Cancelled */}
                  {point.cancelled > 0 && (
                    <div
                      className="bg-red-500 h-6 rounded flex items-center justify-center text-xs text-white"
                      style={{
                        width: `${(point.cancelled / maxCount) * 100}%`,
                        minWidth: '20px'
                      }}
                      title={`${point.cancelled} cancelled`}
                    >
                      {point.cancelled}
                    </div>
                  )}
                  {/* Rescheduled */}
                  {point.rescheduled > 0 && (
                    <div
                      className="bg-yellow-500 h-6 rounded flex items-center justify-center text-xs text-white"
                      style={{
                        width: `${(point.rescheduled / maxCount) * 100}%`,
                        minWidth: '20px'
                      }}
                      title={`${point.rescheduled} rescheduled`}
                    >
                      {point.rescheduled}
                    </div>
                  )}
                  {/* Completed */}
                  {point.completed > 0 && (
                    <div
                      className="bg-blue-500 h-6 rounded flex items-center justify-center text-xs text-white"
                      style={{
                        width: `${(point.completed / maxCount) * 100}%`,
                        minWidth: '20px'
                      }}
                      title={`${point.completed} completed`}
                    >
                      {point.completed}
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-400 w-8 text-right">{point.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span className="text-gray-400">Confirmed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span className="text-gray-400">Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span className="text-gray-400">Rescheduled</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span className="text-gray-400">Cancelled</span>
        </div>
      </div>
    </div>
  )
}
