// F0712: Analytics tab
// F0714: Calls per day chart
// F0715: Bookings per day chart
// F0717: Outcome distribution chart

'use client'

import { useEffect, useState } from 'react'
import FunnelVisualization from './FunnelVisualization'
import SentimentTrendChart from './SentimentTrendChart'

interface AnalyticsData {
  callsPerDay: { date: string; count: number }[]
  bookingsPerDay: { date: string; count: number }[]
  outcomeDistribution: { outcome: string; count: number; percentage: number }[]
  // F0820-F0836: Additional analytics
  noAnswerRate: number
  voicemailRate: number
  avgCallDuration: number
  transferRate: number
  smsDeliveryRate: number
  smsOptOutRate: number
  durationHistogram: { bucket: string; count: number }[]
  sentimentDistribution: { sentiment: string; count: number; percentage: number }[]
  callsByDirection: { direction: string; count: number }[]
  callsByCampaign: { campaign: string; count: number }[]
}

interface Persona {
  id: string
  name: string
  vapi_assistant_id: string
}

interface PeriodComparison {
  changes: {
    total_calls: { value: number; percent: number }
    answer_rate: { value: number; percent: number }
    booking_rate: { value: number; percent: number }
    avg_duration: { value: number; percent: number }
    transfer_rate: { value: number; percent: number }
    avg_quality_score: { value: number; percent: number }
  }
  trend: 'improving' | 'declining' | 'stable'
}

export default function AnalyticsTab() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d')
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selectedPersona, setSelectedPersona] = useState<string>('')
  const [comparison, setComparison] = useState<PeriodComparison | null>(null)
  const [showComparison, setShowComparison] = useState(false)

  useEffect(() => {
    loadPersonas()
  }, [])

  useEffect(() => {
    loadAnalytics()
  }, [dateRange, selectedPersona])

  useEffect(() => {
    if (showComparison) {
      loadComparison()
    }
  }, [showComparison, dateRange, selectedPersona])

  async function loadPersonas() {
    try {
      const res = await fetch('/api/personas')
      const data = await res.json()
      if (data.success) {
        setPersonas(data.data || [])
      }
    } catch (error) {
      console.error('Error loading personas:', error)
    }
  }

  async function loadAnalytics() {
    try {
      const params = new URLSearchParams({ range: dateRange })
      if (selectedPersona) {
        params.set('persona_id', selectedPersona)
      }
      const res = await fetch(`/api/analytics?${params.toString()}`)
      const data = await res.json()
      setAnalytics(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading analytics:', error)
      setLoading(false)
    }
  }

  // F0851: Load period comparison
  async function loadComparison() {
    try {
      const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
      const currentEnd = new Date()
      const currentStart = new Date()
      currentStart.setDate(currentStart.getDate() - daysAgo)

      const previousEnd = new Date(currentStart)
      previousEnd.setDate(previousEnd.getDate() - 1)
      const previousStart = new Date(previousEnd)
      previousStart.setDate(previousStart.getDate() - daysAgo)

      const params = new URLSearchParams({
        current_start: currentStart.toISOString(),
        current_end: currentEnd.toISOString(),
        previous_start: previousStart.toISOString(),
        previous_end: previousEnd.toISOString(),
      })

      if (selectedPersona) {
        params.set('persona_id', selectedPersona)
      }

      const res = await fetch(`/api/analytics/compare?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setComparison(data.data.comparison)
      }
    } catch (error) {
      console.error('Error loading comparison:', error)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading analytics...</p>
      </div>
    )
  }

  if (!analytics) {
    return <p className="text-gray-500 text-center py-12">Failed to load analytics</p>
  }

  const maxCallsPerDay = Math.max(...analytics.callsPerDay.map((d) => d.count), 1)
  const maxBookingsPerDay = Math.max(...analytics.bookingsPerDay.map((d) => d.count), 1)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
          {/* F0851: Period comparison toggle */}
          <button
            onClick={() => setShowComparison(!showComparison)}
            className={`px-3 py-1 text-xs rounded-lg transition ${
              showComparison
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {showComparison ? '✓ ' : ''}Compare Periods
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* F0857: Persona filter */}
          {personas.length > 0 && (
            <select
              value={selectedPersona}
              onChange={(e) => setSelectedPersona(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All Personas</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.vapi_assistant_id}>
                  {persona.name}
                </option>
              ))}
            </select>
          )}

          {/* F0852: Analytics export CSV */}
          <button
            onClick={async () => {
              try {
                const res = await fetch(`/api/analytics/export?range=${dateRange}`)
                const blob = await res.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
              } catch (error) {
                console.error('Export error:', error)
                alert('Failed to export analytics')
              }
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm"
          >
            Export CSV
          </button>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* F0851: Period comparison display */}
      {showComparison && comparison && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900">
              Period Comparison vs Previous {dateRange === '7d' ? '7' : dateRange === '30d' ? '30' : '90'} Days
            </h4>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                comparison.trend === 'improving'
                  ? 'bg-green-100 text-green-800'
                  : comparison.trend === 'declining'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {comparison.trend === 'improving' ? '📈 Improving' : comparison.trend === 'declining' ? '📉 Declining' : '➡️ Stable'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(comparison.changes).map(([key, change]) => {
              const isPositive = change.value > 0
              const label = key
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (l) => l.toUpperCase())
              return (
                <div key={key} className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">{label}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold ${
                        isPositive ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {change.percent.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-500">
                      ({isPositive ? '+' : ''}
                      {key.includes('rate') || key.includes('score')
                        ? change.value.toFixed(1)
                        : Math.round(change.value)}
                      )
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* F0820-F0836: KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* F0820: No-answer rate */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">No-Answer Rate</p>
          <p className="text-2xl font-bold text-gray-900">{analytics.noAnswerRate?.toFixed(1) || '0'}%</p>
        </div>

        {/* F0821: Voicemail rate */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Voicemail Rate</p>
          <p className="text-2xl font-bold text-yellow-600">{analytics.voicemailRate?.toFixed(1) || '0'}%</p>
        </div>

        {/* F0822: Avg call duration */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Avg Duration</p>
          <p className="text-2xl font-bold text-blue-600">
            {analytics.avgCallDuration ? `${Math.floor(analytics.avgCallDuration / 60)}:${String(Math.floor(analytics.avgCallDuration % 60)).padStart(2, '0')}` : '0:00'}
          </p>
        </div>

        {/* F0833: Transfer rate */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Transfer Rate</p>
          <p className="text-2xl font-bold text-purple-600">{analytics.transferRate?.toFixed(1) || '0'}%</p>
        </div>

        {/* F0835: SMS delivery rate */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">SMS Delivery</p>
          <p className="text-2xl font-bold text-green-600">{analytics.smsDeliveryRate?.toFixed(1) || '0'}%</p>
        </div>

        {/* F0836: SMS opt-out rate */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">SMS Opt-Out</p>
          <p className="text-2xl font-bold text-red-600">{analytics.smsOptOutRate?.toFixed(1) || '0'}%</p>
        </div>
      </div>

      {/* F0861, F0862: Funnel visualization with drop-off analysis */}
      <FunnelVisualization dateRange={dateRange} personaId={selectedPersona} />

      {/* F0716: Sentiment trend chart */}
      <SentimentTrendChart dateRange={dateRange} personaId={selectedPersona} />

      {/* F0714: Calls per day chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Calls Per Day</h4>
        <div className="space-y-2">
          {analytics.callsPerDay.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No call data for this period</p>
          ) : (
            analytics.callsPerDay.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <div className="text-xs text-gray-600 w-20">{day.date}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                  <div
                    className="bg-blue-600 h-6 rounded-full flex items-center justify-end pr-2 text-xs text-white font-medium transition-all duration-300"
                    style={{ width: `${(day.count / maxCallsPerDay) * 100}%` }}
                  >
                    {day.count > 0 && day.count}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* F0715: Bookings per day chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Bookings Per Day</h4>
        <div className="space-y-2">
          {analytics.bookingsPerDay.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No booking data for this period</p>
          ) : (
            analytics.bookingsPerDay.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <div className="text-xs text-gray-600 w-20">{day.date}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                  <div
                    className="bg-green-600 h-6 rounded-full flex items-center justify-end pr-2 text-xs text-white font-medium transition-all duration-300"
                    style={{ width: `${(day.count / maxBookingsPerDay) * 100}%` }}
                  >
                    {day.count > 0 && day.count}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* F0717, F0826: Outcome distribution chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Call Outcomes</h4>
        {analytics.outcomeDistribution.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No outcome data for this period</p>
        ) : (
          <div className="space-y-4">
            {analytics.outcomeDistribution.map((outcome) => (
              <div key={outcome.outcome}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                        outcome.outcome === 'booked'
                          ? 'bg-green-100 text-green-800'
                          : outcome.outcome === 'no-answer'
                          ? 'bg-gray-100 text-gray-800'
                          : outcome.outcome === 'voicemail'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {outcome.outcome}
                    </span>
                    <span className="text-sm text-gray-600">{outcome.count} calls</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {outcome.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      outcome.outcome === 'booked'
                        ? 'bg-green-600'
                        : outcome.outcome === 'no-answer'
                        ? 'bg-gray-400'
                        : outcome.outcome === 'voicemail'
                        ? 'bg-yellow-500'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${outcome.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* F0823: Duration histogram */}
      {analytics.durationHistogram && analytics.durationHistogram.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Call Duration Distribution</h4>
          <div className="space-y-2">
            {analytics.durationHistogram.map((bucket) => {
              const maxCount = Math.max(...analytics.durationHistogram.map(b => b.count))
              return (
                <div key={bucket.bucket} className="flex items-center gap-3">
                  <div className="text-xs text-gray-600 w-24">{bucket.bucket}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                    <div
                      className="bg-purple-600 h-6 rounded-full flex items-center justify-end pr-2 text-xs text-white font-medium transition-all duration-300"
                      style={{ width: `${(bucket.count / maxCount) * 100}%` }}
                    >
                      {bucket.count > 0 && bucket.count}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* F0831: Sentiment distribution */}
      {analytics.sentimentDistribution && analytics.sentimentDistribution.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Sentiment Distribution</h4>
          <div className="space-y-4">
            {analytics.sentimentDistribution.map((sentiment) => (
              <div key={sentiment.sentiment}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                        sentiment.sentiment === 'positive'
                          ? 'bg-green-100 text-green-800'
                          : sentiment.sentiment === 'negative'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {sentiment.sentiment}
                    </span>
                    <span className="text-sm text-gray-600">{sentiment.count} calls</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {sentiment.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      sentiment.sentiment === 'positive'
                        ? 'bg-green-600'
                        : sentiment.sentiment === 'negative'
                        ? 'bg-red-600'
                        : 'bg-gray-400'
                    }`}
                    style={{ width: `${sentiment.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* F0827: Calls by direction */}
      {analytics.callsByDirection && analytics.callsByDirection.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Calls by Direction</h4>
          <div className="flex gap-4">
            {analytics.callsByDirection.map((item) => (
              <div key={item.direction} className="flex-1 text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1 capitalize">{item.direction}</p>
                <p className="text-3xl font-bold text-gray-900">{item.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* F0828: Calls by campaign */}
      {analytics.callsByCampaign && analytics.callsByCampaign.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Calls by Campaign</h4>
          <div className="space-y-2">
            {analytics.callsByCampaign.map((item) => {
              const maxCount = Math.max(...analytics.callsByCampaign.map(c => c.count))
              return (
                <div key={item.campaign} className="flex items-center gap-3">
                  <div className="text-xs text-gray-600 w-32 truncate" title={item.campaign}>
                    {item.campaign}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                    <div
                      className="bg-blue-600 h-6 rounded-full flex items-center justify-end pr-2 text-xs text-white font-medium transition-all duration-300"
                      style={{ width: `${(item.count / maxCount) * 100}%` }}
                    >
                      {item.count > 0 && item.count}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
