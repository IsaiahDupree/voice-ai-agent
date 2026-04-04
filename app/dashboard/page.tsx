'use client'

import { useEffect, useState } from 'react'
import BookingAnalytics from './components/BookingAnalytics'
import DateRangePicker from './components/DateRangePicker'
import UserDisplay from './components/UserDisplay'

interface Assistant {
  id: string
  name: string
  model: {
    provider: string
    model: string
  }
  voice: {
    provider: string
    voiceId: string
  }
}

interface Call {
  id: string
  assistantId: string
  status: string
  createdAt: string
  cost?: number
}

interface DateRange {
  startDate: string
  endDate: string
}

export default function Dashboard() {
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [calls, setCalls] = useState<Call[]>([])
  const [filteredCalls, setFilteredCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    }
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // Filter calls by date range
    const filtered = calls.filter(call => {
      const callDate = new Date(call.createdAt).toISOString().split('T')[0]
      return callDate >= dateRange.startDate && callDate <= dateRange.endDate
    })
    setFilteredCalls(filtered)
  }, [calls, dateRange])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [assistantsRes, callsRes] = await Promise.all([
        fetch('/api/vapi/assistant'),
        fetch('/api/calls'),
      ])

      if (assistantsRes.ok) {
        const assistantsData = await assistantsRes.json()
        setAssistants(Array.isArray(assistantsData) ? assistantsData : [])
      } else {
        throw new Error(`Failed to load assistants: ${assistantsRes.statusText}`)
      }

      if (callsRes.ok) {
        const callsData = await callsRes.json()
        setCalls(Array.isArray(callsData) ? callsData : [])
      } else {
        throw new Error(`Failed to load calls: ${callsRes.statusText}`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data'
      console.error('Error loading data:', err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">Voice AI Agent Dashboard</h1>
          <div className="flex items-center gap-2 md:gap-4 flex-wrap">
            {/* F0743: Dashboard refresh button */}
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Refresh dashboard data"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <UserDisplay />
            <a
              href="/"
              className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition"
            >
              Home
            </a>
          </div>
        </div>

        {/* F0734: Dashboard error state */}
        {error ? (
          <div className="text-center py-12">
            <div className="inline-block p-4 bg-red-900 bg-opacity-30 rounded-full mb-4">
              <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">Error Loading Dashboard</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={loadData}
              className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            <p className="mt-4 text-gray-400">Loading...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
            {/* Assistants */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">Assistants</h2>
                <a
                  href="/dashboard/assistants/new"
                  className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 transition text-sm"
                >
                  + New
                </a>
              </div>

              {/* F0735: Dashboard empty state */}
              {assistants.length === 0 ? (
                <div className="text-center py-8">
                  <div className="inline-block p-3 bg-gray-700 rounded-full mb-3">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 font-medium">No assistants created yet</p>
                  <p className="text-gray-500 text-sm mt-1">Create your first AI assistant to get started</p>
                  <a
                    href="/dashboard/assistants/new"
                    className="inline-block mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition text-sm"
                  >
                    Create Assistant
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  {assistants.slice(0, 5).map((assistant) => (
                    <div
                      key={assistant.id}
                      className="bg-gray-700 rounded p-4 hover:bg-gray-650 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{assistant.name}</h3>
                          <p className="text-sm text-gray-400">
                            {assistant.model.provider} / {assistant.model.model}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Voice: {assistant.voice.provider}
                          </p>
                        </div>
                        <a
                          href={`/dashboard/assistants/${assistant.id}`}
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          Edit →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {assistants.length > 5 && (
                <a
                  href="/dashboard/assistants"
                  className="block text-center mt-4 text-blue-400 hover:text-blue-300"
                >
                  View all {assistants.length} assistants →
                </a>
              )}
            </div>

            {/* Recent Calls */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">Recent Calls</h2>
                <DateRangePicker onDateRangeChange={handleDateRangeChange} defaultDays={30} />
              </div>

              {/* F0735: Dashboard empty state */}
              {filteredCalls.length === 0 ? (
                <div className="text-center py-8">
                  <div className="inline-block p-3 bg-gray-700 rounded-full mb-3">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 font-medium">
                    {calls.length === 0 ? 'No calls yet' : 'No calls in selected date range'}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    {calls.length === 0
                      ? 'Launch your first campaign or share your Vapi number'
                      : 'Try adjusting the date range above'}
                  </p>
                  {calls.length === 0 && (
                    <a
                      href="/dashboard/campaigns/new"
                      className="inline-block mt-4 px-4 py-2 bg-green-600 rounded hover:bg-green-700 transition text-sm"
                    >
                      Launch Campaign
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCalls.slice(0, 5).map((call) => (
                    <div
                      key={call.id}
                      className="bg-gray-700 rounded p-4 hover:bg-gray-650 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${
                                call.status === 'in-progress'
                                  ? 'bg-green-500'
                                  : call.status === 'completed'
                                  ? 'bg-blue-500'
                                  : 'bg-gray-500'
                              }`}
                            ></span>
                            <span className="font-semibold capitalize">
                              {call.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mt-1">
                            {new Date(call.createdAt).toLocaleString()}
                          </p>
                          {call.cost && (
                            <p className="text-xs text-gray-500 mt-1">
                              Cost: ${call.cost.toFixed(4)}
                            </p>
                          )}
                        </div>
                        <a
                          href={`/dashboard/calls/${call.id}`}
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          View →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredCalls.length > 5 && (
                <a
                  href="/dashboard/calls"
                  className="block text-center mt-4 text-blue-400 hover:text-blue-300"
                >
                  View all {filteredCalls.length} calls →
                </a>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-2xl font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <a
                  href="/dashboard/assistants/new"
                  className="block bg-blue-600 hover:bg-blue-700 transition rounded p-4 text-center font-semibold"
                >
                  Create New Assistant
                </a>
                <a
                  href="/dashboard/campaigns/new"
                  className="block bg-green-600 hover:bg-green-700 transition rounded p-4 text-center font-semibold"
                >
                  Launch Campaign
                </a>
                <a
                  href="/api/health"
                  target="_blank"
                  className="block bg-gray-700 hover:bg-gray-600 transition rounded p-4 text-center font-semibold"
                >
                  System Health Check
                </a>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl md:text-2xl font-semibold mb-4">Stats (in date range)</h2>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="bg-gray-700 rounded p-4 text-center">
                  <div className="text-3xl font-bold text-blue-400">
                    {assistants.length}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Assistants</div>
                </div>
                <div className="bg-gray-700 rounded p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {filteredCalls.length}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Calls</div>
                </div>
                <div className="bg-gray-700 rounded p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-400">
                    {filteredCalls.filter((c) => c.status === 'in-progress').length}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Active</div>
                </div>
                <div className="bg-gray-700 rounded p-4 text-center">
                  <div className="text-3xl font-bold text-purple-400">
                    $
                    {filteredCalls
                      .reduce((sum, c) => sum + (c.cost || 0), 0)
                      .toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Cost</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* F0331: Booking Analytics Chart */}
        {!loading && (
          <div className="mt-8">
            <BookingAnalytics days={Math.ceil((new Date(dateRange.endDate).getTime() - new Date(dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24))} />
          </div>
        )}
      </div>
    </div>
  )
}
