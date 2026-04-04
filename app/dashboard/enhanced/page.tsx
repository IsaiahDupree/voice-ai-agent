// F0685: Dashboard home route
// F0686: Active calls table
// F0687: Active call columns - caller, duration, status, sentiment, agent
// F0688: Duration counter - increments live
// F0689: Sentiment display
// F0690: Sentiment color coding
// F0691: Real-time update - polls every 5s
// F0692: WebSocket connection
// F0693: WebSocket reconnect
// F0694: Call end removal - ended calls auto-removed
// F0700: Call history table
// F0713: Stats cards
// F0742: Health status indicator

'use client'

import { useEffect, useState } from 'react'
import { useRealtimeCalls } from '@/lib/use-realtime-calls'
import CallDetailDrawer from '../components/CallDetailDrawer'
import CampaignTab from '../components/CampaignTab'
import ContactsTab from '../components/ContactsTab'
import AnalyticsTab from '../components/AnalyticsTab'

interface Call {
  id: number
  call_id: string
  status: string
  direction: string
  phone_number: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  outcome: string | null
  contact_id: number | null
  sentiment?: 'positive' | 'neutral' | 'negative' | null // F0689, F0690
  agent_name?: string | null // F0687
  transfer_status?: string | null // F0678
}

interface HealthStatus {
  status: 'healthy' | 'degraded'
  checks: {
    vapi?: { status: 'ok' | 'error'; message?: string }
    supabase?: { status: 'ok' | 'error'; message?: string }
    twilio?: { status: 'ok' | 'error'; message?: string }
    calcom?: { status: 'ok' | 'error'; message?: string }
  }
}

interface Stats {
  totalCalls: number
  totalBookings: number
  conversionRate: number
  smsSent: number
  activeCalls: number
}

export default function EnhancedDashboard() {
  const [activeCalls, setActiveCalls] = useState<Call[]>([])
  const [callHistory, setCallHistory] = useState<Call[]>([])
  const [stats, setStats] = useState<Stats>({
    totalCalls: 0,
    totalBookings: 0,
    conversionRate: 0,
    smsSent: 0,
    activeCalls: 0,
  })
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'campaigns' | 'contacts' | 'analytics' | 'sms'>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null) // F0734: Dashboard error state
  const [smsLogs, setSmsLogs] = useState<any[]>([]) // F0739: SMS logs
  const [refreshing, setRefreshing] = useState(false) // F0743: Refresh state

  // F0695: Call detail drawer state
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // F0702: Call history filters
  const [historyFilter, setHistoryFilter] = useState<'all' | 'inbound' | 'outbound'>('all')

  // F0703: Call history search
  const [historySearch, setHistorySearch] = useState('')

  // F0704: Pagination
  const [historyPage, setHistoryPage] = useState(1)
  const historyPerPage = 20

  // F0692, F0693: WebSocket connection with auto-reconnect
  const { connected: wsConnected, lastUpdate: wsLastUpdate } = useRealtimeCalls()

  // F0691: Real-time update - poll every 5s as fallback
  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [])

  // F0694: Listen for real-time call updates and refresh data
  useEffect(() => {
    const handleCallUpdate = () => {
      loadData()
    }

    window.addEventListener('call-update', handleCallUpdate)
    return () => window.removeEventListener('call-update', handleCallUpdate)
  }, [])

  async function loadData() {
    try {
      setError(null) // F0734: Clear any previous errors
      // Load active calls, call history, stats, health, and SMS logs in parallel
      const [callsRes, statsRes, healthRes, smsRes] = await Promise.all([
        fetch('/api/calls'),
        fetch('/api/analytics/stats'),
        fetch('/api/health'),
        fetch('/api/sms'), // F0739: Load SMS logs
      ])

      // F0734: Check for API errors
      if (!callsRes.ok) {
        throw new Error(`Failed to load calls: ${callsRes.status} ${callsRes.statusText}`)
      }

      if (callsRes.ok) {
        const callsData = await callsRes.json()
        const calls = Array.isArray(callsData) ? callsData : callsData.calls || []

        // F0686: Active calls - filter for in-progress
        const active = calls.filter(
          (call: Call) => call.status === 'in-progress' || call.status === 'ringing'
        )
        setActiveCalls(active)

        // F0700: Call history - all completed calls
        const history = calls.filter(
          (call: Call) => call.status === 'ended' || call.status === 'completed'
        )
        setCallHistory(history.slice(0, 20)) // Latest 20
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      if (healthRes.ok) {
        const healthData = await healthRes.json()
        setHealth(healthData)
      }

      // F0739: Load SMS logs
      if (smsRes.ok) {
        const smsData = await smsRes.json()
        setSmsLogs(Array.isArray(smsData) ? smsData : smsData.sms || [])
      }

      setLoading(false)
    } catch (error: any) {
      // F0734: Dashboard error state
      console.error('Error loading dashboard data:', error)
      setError(error.message || 'Failed to load dashboard data. Please try again.')
      setLoading(false)
    }
  }

  // F0743: Manual refresh function
  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
    setTimeout(() => setRefreshing(false), 500) // Brief delay for visual feedback
  }

  // F0688: Duration counter - calculate duration for active calls
  function calculateDuration(startedAt: string): number {
    const start = new Date(startedAt).getTime()
    const now = Date.now()
    return Math.floor((now - start) / 1000)
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Force re-render every second to update durations
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // F0695: Open call detail drawer
  function openCallDetail(callId: string) {
    setSelectedCallId(callId)
    setDrawerOpen(true)
  }

  // F0702, F0703: Filter and search call history
  const filteredHistory = callHistory
    .filter((call) => {
      // F0702: Direction filter
      if (historyFilter !== 'all' && call.direction !== historyFilter) {
        return false
      }
      // F0703: Search by phone number
      if (historySearch && !call.phone_number?.includes(historySearch)) {
        return false
      }
      return true
    })

  // F0704: Paginate history
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * historyPerPage,
    historyPage * historyPerPage
  )
  const totalPages = Math.ceil(filteredHistory.length / historyPerPage)

  // F0705: Export call history
  async function exportCallHistory() {
    try {
      const res = await fetch('/api/calls?format=csv')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `call-history-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export call history')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* F0742: Health status indicator */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Voice AI Agent Dashboard</h1>
          <div className="flex items-center gap-4">
            {/* F0743: Dashboard refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-white rounded-lg shadow hover:bg-gray-50 transition disabled:opacity-50 flex items-center gap-2"
              title="Refresh dashboard data"
            >
              <svg
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            {/* F0692: WebSocket connection status */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow">
              <div
                className={`w-3 h-3 rounded-full ${
                  wsConnected ? 'bg-green-500' : 'bg-gray-400'
                }`}
              ></div>
              <span className="text-sm font-medium">
                {wsConnected ? 'Live' : 'Connecting...'}
              </span>
            </div>
            {health && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow">
                <div
                  className={`w-3 h-3 rounded-full ${
                    health.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                ></div>
                <span className="text-sm font-medium">
                  {health.status === 'healthy' ? 'All Systems Operational' : 'Degraded'}
                </span>
                {health.status === 'degraded' && (
                  <button
                    onClick={() => alert(JSON.stringify(health.checks, null, 2))}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Details
                  </button>
                )}
              </div>
            )}
            <a
              href="/dashboard"
              className="px-4 py-2 bg-white rounded-lg shadow hover:bg-gray-50 transition text-sm font-medium"
            >
              ← Back
            </a>
          </div>
        </div>

        {/* F0713: Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600">Total Calls</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{stats.totalCalls}</div>
          </div>
          {/* F0748: Dashboard live call count */}
          <div className="bg-white rounded-lg shadow p-6 border-2 border-green-200">
            <div className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Live Calls
            </div>
            <div className="text-3xl font-bold text-green-600 mt-2">{activeCalls.length}</div>
            <div className="text-xs text-gray-500 mt-1">
              {activeCalls.length === 1 ? '1 call' : `${activeCalls.length} calls`} in progress
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600">Bookings</div>
            <div className="text-3xl font-bold text-blue-600 mt-2">{stats.totalBookings}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600">Conversion Rate</div>
            <div className="text-3xl font-bold text-purple-600 mt-2">
              {stats.conversionRate.toFixed(1)}%
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600">SMS Sent</div>
            <div className="text-3xl font-bold text-orange-600 mt-2">{stats.smsSent}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('active')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'active'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Active Calls ({activeCalls.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Call History
              </button>
              {/* F0706: Campaign tab */}
              <button
                onClick={() => setActiveTab('campaigns')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'campaigns'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Campaigns
              </button>
              {/* F0710: Contacts tab */}
              <button
                onClick={() => setActiveTab('contacts')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'contacts'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Contacts
              </button>
              {/* F0712: Analytics tab */}
              <button
                onClick={() => setActiveTab('analytics')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'analytics'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Analytics
              </button>
              {/* F0739: SMS tab */}
              <button
                onClick={() => setActiveTab('sms')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'sms'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                SMS ({smsLogs.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* F0733: Dashboard loading state */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Loading dashboard data...</p>
              </div>
            ) : error ? (
              /* F0734: Dashboard error state */
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Dashboard</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={() => {
                    setLoading(true)
                    loadData()
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                {/* F0686: Active calls table */}
                {activeTab === 'active' && (
                  <div>
                    {activeCalls.length === 0 ? (
                      /* F0735: Dashboard empty state */
                      <div className="text-center py-12">
                        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Calls</h3>
                        <p className="text-gray-600 mb-4">There are no calls in progress right now</p>
                        <a
                          href="/dashboard/campaigns/new"
                          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          Start a Campaign
                        </a>
                      </div>
                    ) : (
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {/* F0687: Active call columns */}
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Caller
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Duration
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Sentiment
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Agent
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {activeCalls.map((call) => (
                            <tr
                              key={call.id}
                              className="hover:bg-gray-50 cursor-pointer"
                              onClick={() => openCallDetail(call.call_id)}
                            >
                              {/* F0687, F0751: Caller column with contact link */}
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{call.phone_number || 'Unknown'}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded ${
                                      call.direction === 'inbound'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-green-100 text-green-800'
                                    }`}
                                  >
                                    {call.direction}
                                  </span>
                                  {/* F0751: Dashboard contact link */}
                                  {call.contact_id && (
                                    <a
                                      href={`/dashboard/contacts/${call.contact_id}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-blue-600 hover:underline"
                                    >
                                      View Contact
                                    </a>
                                  )}
                                </div>
                              </td>
                              {/* F0688: Duration counter */}
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                                {formatDuration(calculateDuration(call.started_at))}
                              </td>
                              {/* F0687: Status column */}
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  call.status === 'in-progress' ? 'bg-green-100 text-green-800' :
                                  call.status === 'ringing' ? 'bg-yellow-100 text-yellow-800' :
                                  call.transfer_status ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {call.transfer_status || call.status}
                                </span>
                              </td>
                              {/* F0689, F0690: Sentiment badge with color coding */}
                              <td className="px-6 py-4 whitespace-nowrap">
                                {call.sentiment ? (
                                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    call.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                                    call.sentiment === 'neutral' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {call.sentiment}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">analyzing...</span>
                                )}
                              </td>
                              {/* F0687: Agent column */}
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {call.agent_name || 'AI Agent'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* F0700: Call history table */}
                {activeTab === 'history' && (
                  <div>
                    {/* F0702, F0703, F0705: Filters, search, and export */}
                    <div className="mb-4 flex gap-4 items-center">
                      {/* F0703: Search */}
                      <input
                        type="text"
                        placeholder="Search by phone number..."
                        value={historySearch}
                        onChange={(e) => {
                          setHistorySearch(e.target.value)
                          setHistoryPage(1) // Reset to page 1 on search
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />

                      {/* F0702: Direction filter */}
                      <select
                        value={historyFilter}
                        onChange={(e) => {
                          setHistoryFilter(e.target.value as 'all' | 'inbound' | 'outbound')
                          setHistoryPage(1) // Reset to page 1 on filter change
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Calls</option>
                        <option value="inbound">Inbound Only</option>
                        <option value="outbound">Outbound Only</option>
                      </select>

                      {/* F0705: Export button */}
                      <button
                        onClick={exportCallHistory}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Export CSV
                      </button>
                    </div>

                    {filteredHistory.length === 0 ? (
                      /* F0735: Dashboard empty state for call history */
                      <div className="text-center py-12">
                        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {historySearch || historyFilter !== 'all' ? 'No Matching Calls' : 'No Call History'}
                        </h3>
                        <p className="text-gray-600 mb-4">
                          {historySearch || historyFilter !== 'all'
                            ? 'Try adjusting your search or filters'
                            : 'Your completed calls will appear here'}
                        </p>
                        {(historySearch || historyFilter !== 'all') && (
                          <button
                            onClick={() => {
                              setHistorySearch('')
                              setHistoryFilter('all')
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                    ) : (
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {/* F0701: Call history columns */}
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Time
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Direction
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Phone Number
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Duration
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Sentiment
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Outcome
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paginatedHistory.map((call) => (
                            <tr
                              key={call.id}
                              className="hover:bg-gray-50 cursor-pointer"
                              onClick={() => openCallDetail(call.call_id)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(call.started_at).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span
                                  className={`px-2 py-1 rounded ${
                                    call.direction === 'inbound'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-green-100 text-green-800'
                                  }`}
                                >
                                  {call.direction}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div>{call.phone_number || 'Unknown'}</div>
                                {/* F0751: Dashboard contact link in history */}
                                {call.contact_id && (
                                  <a
                                    href={`/dashboard/contacts/${call.contact_id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    View Contact
                                  </a>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                                {call.duration_seconds
                                  ? formatDuration(call.duration_seconds)
                                  : 'N/A'}
                              </td>
                              {/* F0701: Sentiment column */}
                              <td className="px-6 py-4 whitespace-nowrap">
                                {call.sentiment ? (
                                  <span
                                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                      call.sentiment === 'positive'
                                        ? 'bg-green-100 text-green-800'
                                        : call.sentiment === 'neutral'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {call.sentiment}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    call.outcome === 'booked'
                                      ? 'bg-green-100 text-green-800'
                                      : call.outcome === 'no-answer'
                                      ? 'bg-gray-100 text-gray-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {call.outcome || 'unknown'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* F0704: Pagination controls */}
                    {filteredHistory.length > historyPerPage && (
                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-sm text-gray-700">
                          Showing {(historyPage - 1) * historyPerPage + 1} to{' '}
                          {Math.min(historyPage * historyPerPage, filteredHistory.length)} of{' '}
                          {filteredHistory.length} calls
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                            disabled={historyPage === 1}
                            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              const page = i + 1
                              return (
                                <button
                                  key={page}
                                  onClick={() => setHistoryPage(page)}
                                  className={`px-3 py-1 border rounded ${
                                    historyPage === page
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  {page}
                                </button>
                              )
                            })}
                            {totalPages > 5 && <span className="px-2">...</span>}
                          </div>
                          <button
                            onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                            disabled={historyPage === totalPages}
                            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* F0706: Campaign tab */}
                {activeTab === 'campaigns' && <CampaignTab />}

                {/* F0710: Contacts tab */}
                {activeTab === 'contacts' && <ContactsTab />}

                {/* F0712: Analytics tab */}
                {activeTab === 'analytics' && <AnalyticsTab />}

                {/* F0739, F0740: SMS tab */}
                {activeTab === 'sms' && (
                  <div>
                    <div className="mb-4 flex justify-between items-center">
                      <h2 className="text-lg font-semibold">SMS Message Log</h2>
                      <div className="text-sm text-gray-600">
                        Total: {smsLogs.length} messages
                      </div>
                    </div>
                    {smsLogs.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No SMS Messages</h3>
                        <p className="text-gray-600">SMS follow-ups will appear here after calls</p>
                      </div>
                    ) : (
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Time
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              To
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Message
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {smsLogs.map((sms, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {sms.created_at ? new Date(sms.created_at).toLocaleString() : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                                {sms.to_number || sms.to || '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                                <div className="truncate">{sms.body || sms.message || '-'}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {/* F0740: SMS status display */}
                                <span
                                  className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    sms.status === 'delivered'
                                      ? 'bg-green-100 text-green-800'
                                      : sms.status === 'sent' || sms.status === 'queued'
                                      ? 'bg-blue-100 text-blue-800'
                                      : sms.status === 'failed'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {sms.status || 'unknown'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* F0695: Call detail drawer */}
        {selectedCallId && (
          <CallDetailDrawer
            callId={selectedCallId}
            isOpen={drawerOpen}
            onClose={() => {
              setDrawerOpen(false)
              setSelectedCallId(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
