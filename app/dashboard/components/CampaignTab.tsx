// F0706: Campaign tab
// F0707: Campaign progress bar
// F0708: Campaign start button
// F0709: Campaign stop button

'use client'

import { useEffect, useState } from 'react'

interface Campaign {
  id: number
  name: string
  status: 'draft' | 'running' | 'paused' | 'completed'
  total_contacts: number
  calls_attempted: number
  calls_completed: number
  calls_successful: number
  started_at: string | null
  ended_at: string | null
}

export default function CampaignTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCampaigns()
  }, [])

  async function loadCampaigns() {
    try {
      const res = await fetch('/api/campaigns')
      const data = await res.json()
      setCampaigns(Array.isArray(data) ? data : data.campaigns || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading campaigns:', error)
      setLoading(false)
    }
  }

  // F0708: Start campaign
  async function startCampaign(campaignId: number) {
    if (!confirm('Start this campaign?')) return

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: 'POST',
      })

      const result = await res.json()

      if (result.success) {
        alert('Campaign started!')
        loadCampaigns()
      } else {
        alert(`Failed to start: ${result.error}`)
      }
    } catch (error) {
      console.error('Start campaign error:', error)
      alert('Failed to start campaign')
    }
  }

  // F0709: Stop campaign
  async function stopCampaign(campaignId: number) {
    if (!confirm('Stop this campaign?')) return

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/stop`, {
        method: 'POST',
      })

      const result = await res.json()

      if (result.success) {
        alert('Campaign stopped!')
        loadCampaigns()
      } else {
        alert(`Failed to stop: ${result.error}`)
      }
    } catch (error) {
      console.error('Stop campaign error:', error)
      alert('Failed to stop campaign')
    }
  }

  // F0707: Calculate progress percentage
  function getProgress(campaign: Campaign): number {
    if (campaign.total_contacts === 0) return 0
    return Math.round((campaign.calls_attempted / campaign.total_contacts) * 100)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading campaigns...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Outbound Campaigns</h3>
        <a
          href="/dashboard/campaigns/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + New Campaign
        </a>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No campaigns yet. Create one to get started.
        </p>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{campaign.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        campaign.status === 'running'
                          ? 'bg-green-100 text-green-800'
                          : campaign.status === 'paused'
                          ? 'bg-yellow-100 text-yellow-800'
                          : campaign.status === 'completed'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {campaign.status}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {campaign.status === 'draft' || campaign.status === 'paused' ? (
                    // F0708: Start button
                    <button
                      onClick={() => startCampaign(campaign.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                    >
                      Start
                    </button>
                  ) : campaign.status === 'running' ? (
                    // F0709: Stop button
                    <button
                      onClick={() => stopCampaign(campaign.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                    >
                      Stop
                    </button>
                  ) : null}

                  <a
                    href={`/dashboard/campaigns/${campaign.id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                  >
                    View Details
                  </a>
                </div>
              </div>

              {/* F0707: Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>
                    {campaign.calls_attempted} / {campaign.total_contacts} contacts attempted
                  </span>
                  <span>{getProgress(campaign)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgress(campaign)}%` }}
                  ></div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <div className="text-xs text-gray-500">Completed</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {campaign.calls_completed}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Successful</div>
                  <div className="text-lg font-semibold text-green-600">
                    {campaign.calls_successful}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Success Rate</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {campaign.calls_completed > 0
                      ? `${Math.round(
                          (campaign.calls_successful / campaign.calls_completed) * 100
                        )}%`
                      : '0%'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
