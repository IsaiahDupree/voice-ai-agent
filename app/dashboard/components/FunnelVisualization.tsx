// F0861: Funnel visualization - Calls > Answered > Interested > Booked

'use client'

import { useEffect, useState } from 'react'

interface FunnelStage {
  name: string
  count: number
  percentage: number
  dropOffRate?: number
}

interface FunnelData {
  funnel: FunnelStage[]
  overallConversionRate: number
}

interface FunnelVisualizationProps {
  dateRange: string
  personaId?: string
}

export default function FunnelVisualization({ dateRange, personaId }: FunnelVisualizationProps) {
  const [data, setData] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFunnel()
  }, [dateRange, personaId])

  async function loadFunnel() {
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

      const res = await fetch(`/api/analytics/funnel?${params.toString()}`)
      const result = await res.json()

      if (result.success) {
        setData(result.data)
      }
      setLoading(false)
    } catch (error) {
      console.error('Error loading funnel:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Conversion Funnel</h4>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Conversion Funnel</h4>
        <p className="text-gray-500 text-center py-8">Failed to load funnel data</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-md font-semibold text-gray-900">Conversion Funnel</h4>
        <div className="text-sm">
          <span className="text-gray-600">Overall Conversion: </span>
          <span className="font-bold text-green-600">
            {data.overallConversionRate.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {data.funnel.map((stage, index) => {
          const maxCount = data.funnel[0].count
          const widthPercent = maxCount > 0 ? (stage.count / maxCount) * 100 : 0

          return (
            <div key={stage.name} className="relative">
              {/* Stage label and stats */}
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">
                    {index + 1}. {stage.name}
                  </span>
                  <span className="text-sm text-gray-600">{stage.count} calls</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-blue-600">
                    {stage.percentage.toFixed(1)}%
                  </span>
                  {stage.dropOffRate !== undefined && stage.dropOffRate > 0 && (
                    <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      -{stage.dropOffRate.toFixed(1)}% drop-off
                    </span>
                  )}
                </div>
              </div>

              {/* Funnel bar */}
              <div
                className="relative h-12 rounded-lg transition-all duration-500 ease-out flex items-center justify-between px-4"
                style={{
                  width: `${widthPercent}%`,
                  background: `linear-gradient(to right,
                    ${
                      index === 0
                        ? '#3B82F6'
                        : index === 1
                        ? '#60A5FA'
                        : index === 2
                        ? '#93C5FD'
                        : '#10B981'
                    },
                    ${
                      index === 0
                        ? '#2563EB'
                        : index === 1
                        ? '#3B82F6'
                        : index === 2
                        ? '#60A5FA'
                        : '#059669'
                    })`,
                }}
              >
                <span className="text-white font-medium text-sm">{stage.name}</span>
                <span className="text-white font-bold">{stage.count}</span>
              </div>

              {/* Drop-off indicator */}
              {index < data.funnel.length - 1 && stage.dropOffRate && stage.dropOffRate > 0 && (
                <div className="ml-4 mt-1 flex items-center gap-1">
                  <svg
                    className="w-4 h-4 text-red-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs text-gray-500">
                    {Math.round(stage.count * (stage.dropOffRate / 100))} lost
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* F0862: Drop-off analysis summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h5 className="text-sm font-semibold text-gray-700 mb-2">Drop-off Analysis</h5>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {data.funnel
            .filter((stage) => stage.dropOffRate !== undefined && stage.dropOffRate > 0)
            .map((stage, index) => (
              <div key={stage.name} className="flex justify-between items-center">
                <span className="text-gray-600">{stage.name}:</span>
                <span className="font-semibold text-red-600">
                  {stage.dropOffRate?.toFixed(1)}% loss
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
