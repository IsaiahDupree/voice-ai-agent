// F0718: Campaign conversion chart - bar chart showing conversion rate per campaign

'use client'

import { useEffect, useState } from 'react'

interface CampaignData {
  campaign_id: string
  campaign_name: string
  total_calls: number
  bookings: number
  conversion_rate: number
  avg_duration: number
  avg_sentiment: number
}

interface CampaignConversionChartProps {
  dateRange: string
  limit?: number
}

export default function CampaignConversionChart({
  dateRange,
  limit = 10,
}: CampaignConversionChartProps) {
  const [data, setData] = useState<CampaignData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCampaigns()
  }, [dateRange])

  async function loadCampaigns() {
    try {
      setLoading(true)

      // Calculate date range
      const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - daysAgo)

      const params = new URLSearchParams()
      params.set('start_date', startDate.toISOString())
      params.set('end_date', endDate.toISOString())
      params.set('limit', limit.toString())

      const res = await fetch(`/api/analytics/campaign-conversion?${params.toString()}`)
      const result = await res.json()

      if (result.success) {
        setData(result.data)
      }
      setLoading(false)
    } catch (error) {
      console.error('Error loading campaign conversion data:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Campaign Conversion Rate</h4>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Campaign Conversion Rate</h4>
        <p className="text-gray-500 text-center py-8">No campaign data available</p>
      </div>
    )
  }

  // Find max conversion rate for scaling
  const maxConversion = Math.max(...data.map((c) => c.conversion_rate), 1)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-2">Campaign Conversion Rate</h4>
          <p className="text-sm text-gray-600">
            Bookings per campaign (showing top {limit})
          </p>
        </div>

        <div className="text-xs text-gray-600">
          <span className="font-medium">Total: </span>
          {data.reduce((sum, c) => sum + c.total_calls, 0)} calls
        </div>
      </div>

      {/* Horizontal bar chart */}
      <div className="space-y-4">
        {data.map((campaign) => (
          <div key={campaign.campaign_id} className="group">
            {/* Campaign name and stats */}
            <div className="flex justify-between items-baseline mb-1">
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {campaign.campaign_name || 'Unnamed Campaign'}
                </p>
                <p className="text-xs text-gray-500">
                  {campaign.total_calls} calls · {campaign.bookings} bookings
                </p>
              </div>
              <div className="flex items-baseline gap-2 text-right">
                <span className={`text-lg font-bold ${
                  campaign.conversion_rate >= 20 ? 'text-green-600' :
                  campaign.conversion_rate >= 10 ? 'text-blue-600' :
                  'text-gray-900'
                }`}>
                  {campaign.conversion_rate.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
              <div
                className={`absolute left-0 top-0 bottom-0 rounded-lg transition-all duration-500 ${
                  campaign.conversion_rate >= 20
                    ? 'bg-gradient-to-r from-green-500 to-green-600'
                    : campaign.conversion_rate >= 10
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                    : 'bg-gradient-to-r from-gray-400 to-gray-500'
                }`}
                style={{
                  width: `${(campaign.conversion_rate / maxConversion) * 100}%`,
                }}
              >
                {/* Show bookings count inside bar if wide enough */}
                {campaign.conversion_rate / maxConversion > 0.15 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-xs font-medium">
                    {campaign.bookings} bookings
                  </span>
                )}
              </div>

              {/* Show bookings count outside bar if too narrow */}
              {campaign.conversion_rate / maxConversion <= 0.15 && campaign.bookings > 0 && (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs font-medium">
                  {campaign.bookings} bookings
                </span>
              )}
            </div>

            {/* Additional stats on hover */}
            <div className="hidden group-hover:block mt-2 text-xs text-gray-600 space-x-4">
              <span>Avg duration: {Math.round(campaign.avg_duration / 60)}m</span>
              <span>Avg sentiment: {campaign.avg_sentiment.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-blue-600">
            {data.reduce((sum, c) => sum + c.total_calls, 0)}
          </p>
          <p className="text-xs text-gray-600">Total Calls</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-600">
            {data.reduce((sum, c) => sum + c.bookings, 0)}
          </p>
          <p className="text-xs text-gray-600">Total Bookings</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-purple-600">
            {(
              (data.reduce((sum, c) => sum + c.bookings, 0) /
                data.reduce((sum, c) => sum + c.total_calls, 0)) *
              100
            ).toFixed(1)}%
          </p>
          <p className="text-xs text-gray-600">Overall Rate</p>
        </div>
      </div>
    </div>
  )
}
