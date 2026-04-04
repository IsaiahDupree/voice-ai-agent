// F0716: Sentiment trend chart - line chart showing sentiment over time

'use client'

import { useEffect, useState } from 'react'

interface SentimentDataPoint {
  date: string
  positive: number
  neutral: number
  negative: number
  avgScore: number
}

interface SentimentTrendData {
  trend: SentimentDataPoint[]
  summary: {
    totalCalls: number
    totalPositive: number
    totalNeutral: number
    totalNegative: number
    overallAvgScore: number
    positiveRate: number
    negativeRate: number
  }
}

interface SentimentTrendChartProps {
  dateRange: string
  personaId?: string
}

export default function SentimentTrendChart({
  dateRange,
  personaId,
}: SentimentTrendChartProps) {
  const [data, setData] = useState<SentimentTrendData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTrend()
  }, [dateRange, personaId])

  async function loadTrend() {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      // Calculate date range
      const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - daysAgo)

      params.set('start_date', startDate.toISOString())
      params.set('end_date', endDate.toISOString())

      if (personaId) {
        params.set('persona_id', personaId)
      }

      const res = await fetch(`/api/analytics/sentiment-trend?${params.toString()}`)
      const result = await res.json()

      if (result.success) {
        setData(result.data)
      }
      setLoading(false)
    } catch (error) {
      console.error('Error loading sentiment trend:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Sentiment Trend</h4>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (!data || data.trend.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Sentiment Trend</h4>
        <p className="text-gray-500 text-center py-8">No sentiment data available</p>
      </div>
    )
  }

  // Find max value for scaling
  const maxCount = Math.max(
    ...data.trend.map((d) => d.positive + d.neutral + d.negative),
    1
  )

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-2">Sentiment Trend</h4>
          <p className="text-sm text-gray-600">
            Average sentiment score: {' '}
            <span
              className={`font-bold ${
                data.summary.overallAvgScore > 0.3
                  ? 'text-green-600'
                  : data.summary.overallAvgScore < -0.3
                  ? 'text-red-600'
                  : 'text-gray-600'
              }`}
            >
              {data.summary.overallAvgScore.toFixed(2)}
            </span>
          </p>
        </div>

        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-gray-600">
              Positive ({data.summary.positiveRate.toFixed(0)}%)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-400 rounded"></div>
            <span className="text-gray-600">Neutral</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-gray-600">
              Negative ({data.summary.negativeRate.toFixed(0)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Line chart */}
      <div className="relative" style={{ height: '200px' }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-500 pr-2">
          <span>{maxCount}</span>
          <span>{Math.round(maxCount / 2)}</span>
          <span>0</span>
        </div>

        {/* Chart area */}
        <div className="ml-8 h-full flex items-end justify-between gap-1">
          {data.trend.map((point, index) => {
            const total = point.positive + point.neutral + point.negative
            const height = maxCount > 0 ? (total / maxCount) * 100 : 0

            const positiveHeight = total > 0 ? (point.positive / total) * height : 0
            const neutralHeight = total > 0 ? (point.neutral / total) * height : 0
            const negativeHeight = total > 0 ? (point.negative / total) * height : 0

            // Only show date label for select points
            const showLabel =
              index === 0 ||
              index === data.trend.length - 1 ||
              index % Math.ceil(data.trend.length / 7) === 0

            return (
              <div key={point.date} className="flex-1 flex flex-col items-center">
                {/* Stacked bar */}
                <div className="w-full flex flex-col justify-end" style={{ height: '180px' }}>
                  {total > 0 && (
                    <div className="w-full flex flex-col">
                      {/* Positive */}
                      {point.positive > 0 && (
                        <div
                          className="w-full bg-green-500 rounded-t transition-all duration-300"
                          style={{ height: `${positiveHeight}%` }}
                          title={`${point.positive} positive calls`}
                        ></div>
                      )}
                      {/* Neutral */}
                      {point.neutral > 0 && (
                        <div
                          className="w-full bg-gray-400 transition-all duration-300"
                          style={{ height: `${neutralHeight}%` }}
                          title={`${point.neutral} neutral calls`}
                        ></div>
                      )}
                      {/* Negative */}
                      {point.negative > 0 && (
                        <div
                          className="w-full bg-red-500 rounded-b transition-all duration-300"
                          style={{ height: `${negativeHeight}%` }}
                          title={`${point.negative} negative calls`}
                        ></div>
                      )}
                    </div>
                  )}
                </div>

                {/* Date label */}
                {showLabel && (
                  <div className="text-xs text-gray-500 mt-1 -rotate-45 origin-top-left whitespace-nowrap">
                    {new Date(point.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Summary stats */}
      <div className="mt-6 pt-4 border-t border-gray-200 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{data.summary.totalPositive}</p>
          <p className="text-xs text-gray-600">Positive Calls</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-600">{data.summary.totalNeutral}</p>
          <p className="text-xs text-gray-600">Neutral Calls</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-red-600">{data.summary.totalNegative}</p>
          <p className="text-xs text-gray-600">Negative Calls</p>
        </div>
      </div>
    </div>
  )
}
