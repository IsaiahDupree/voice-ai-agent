/**
 * Feature 216: Scheduling Dashboard
 * Provider switcher, configuration display, and health status
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Provider {
  name: string
  displayName: string
  active: boolean
  configured: boolean
  requiredEnvVars: string[]
  optionalEnvVars: string[]
  description: string
  docsUrl: string
}

interface ProviderInfo {
  name: string
  displayName: string
  configured: boolean
  valid: boolean
  errors: string[]
}

interface HealthInfo {
  provider: {
    name: string
    configured: string
    healthy: boolean
    responseTime: string
    error: string | null
  }
  status: string
  timestamp: string
}

interface Booking {
  id: string
  contact_name: string
  email: string
  scheduled_time: string
  status: string
}

export default function SchedulingPage() {
  const [providersData, setProvidersData] = useState<{
    currentProvider: ProviderInfo
    availableProviders: Provider[]
    switchInstructions: string
  } | null>(null)
  const [healthData, setHealthData] = useState<HealthInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [googleCalendarName, setGoogleCalendarName] = useState<string | null>(null)

  useEffect(() => {
    fetchProviderInfo()
    fetchHealthStatus()
    checkGoogleCalendarStatus()
    fetchUpcomingBookings()
  }, [])

  async function fetchProviderInfo() {
    try {
      setLoading(true)
      const response = await fetch('/api/scheduling/providers')
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setProvidersData(data)
    } catch (err: any) {
      console.error('Error fetching provider info:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchHealthStatus() {
    try {
      const response = await fetch('/api/scheduling/health')
      const data = await response.json()

      setHealthData(data)
    } catch (err: any) {
      console.error('Error fetching health status:', err)
    }
  }

  async function checkGoogleCalendarStatus() {
    try {
      const response = await fetch('/api/agent/config')
      if (response.ok) {
        const config = await response.json()
        if (config.google_calendar_token) {
          setGoogleCalendarConnected(true)
          setGoogleCalendarName(config.google_calendar_name || 'Google Calendar')
        }
      }
    } catch (err: any) {
      console.error('Error checking Google Calendar status:', err)
    }
  }

  async function fetchUpcomingBookings() {
    try {
      const response = await fetch('/api/bookings?limit=5')
      if (response.ok) {
        const data = await response.json()
        setBookings(Array.isArray(data) ? data : data.bookings || [])
      }
    } catch (err: any) {
      console.error('Error fetching bookings:', err)
    }
  }

  function handleGoogleCalendarConnect() {
    window.location.href = '/api/auth/google-calendar'
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Scheduling Configuration</h1>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Scheduling Configuration</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Scheduling Configuration</h1>
        <p className="text-gray-600">
          Manage scheduling providers for appointment booking
        </p>
      </div>

      {/* Current Provider Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Active Provider</CardTitle>
            <CardDescription>Currently configured scheduling provider</CardDescription>
          </CardHeader>
          <CardContent>
            {providersData && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Provider:</span>
                  <span className="text-lg">{providersData.currentProvider.displayName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Status:</span>
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      providersData.currentProvider.configured && providersData.currentProvider.valid
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {providersData.currentProvider.configured && providersData.currentProvider.valid
                      ? 'Configured'
                      : 'Not Configured'}
                  </span>
                </div>
                {providersData.currentProvider.errors.length > 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm font-semibold text-red-800">Configuration Errors:</p>
                    <ul className="text-sm text-red-700 list-disc list-inside">
                      {providersData.currentProvider.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Health Status</CardTitle>
            <CardDescription>API connectivity and authentication</CardDescription>
          </CardHeader>
          <CardContent>
            {healthData ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Status:</span>
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      healthData.provider.healthy
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {healthData.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Response Time:</span>
                  <span>{healthData.provider.responseTime}</span>
                </div>
                {healthData.provider.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-700">{healthData.provider.error}</p>
                  </div>
                )}
                <div className="mt-4">
                  <Button
                    onClick={fetchHealthStatus}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    🔄 Refresh Health Check
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500">Loading health status...</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Google Calendar Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Google Calendar Integration</CardTitle>
          <CardDescription>Connect your Google Calendar for automatic booking scheduling</CardDescription>
        </CardHeader>
        <CardContent>
          {googleCalendarConnected ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold">Connected Calendar</p>
                  <p className="text-sm text-gray-600">{googleCalendarName}</p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                  Connected
                </span>
              </div>

              {/* Upcoming Bookings */}
              {bookings.length > 0 ? (
                <div className="mt-6">
                  <h4 className="font-semibold mb-3">Upcoming Bookings</h4>
                  <div className="space-y-2">
                    {bookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="p-3 border rounded-lg bg-gray-50 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-sm">{booking.contact_name}</p>
                          <p className="text-xs text-gray-600">
                            {new Date(booking.scheduled_time).toLocaleString()}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                          {booking.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">No upcoming bookings scheduled.</p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                Connect your Google Calendar to automatically sync bookings from your agent calls.
              </p>
              <Button onClick={handleGoogleCalendarConnect} className="bg-blue-600 hover:bg-blue-700">
                📅 Connect Google Calendar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Providers */}
      <Card>
        <CardHeader>
          <CardTitle>Available Providers</CardTitle>
          <CardDescription>All supported scheduling platforms</CardDescription>
        </CardHeader>
        <CardContent>
          {providersData && (
            <div className="space-y-4">
              {providersData.availableProviders.map((provider) => (
                <div
                  key={provider.name}
                  className={`p-4 border rounded-lg ${
                    provider.active ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">{provider.displayName}</h3>
                      <p className="text-sm text-gray-600">{provider.description}</p>
                    </div>
                    <div className="flex gap-2">
                      {provider.active && (
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                          ACTIVE
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          provider.configured
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {provider.configured ? 'Configured' : 'Not Configured'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-sm">
                    <p className="font-semibold mb-1">Required Environment Variables:</p>
                    <ul className="list-disc list-inside text-gray-700">
                      {provider.requiredEnvVars.map((envVar) => (
                        <li key={envVar}>
                          <code className="bg-gray-100 px-1 rounded">{envVar}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      📚 Documentation →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
          {providersData && (
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded">
              <p className="text-sm text-gray-700">
                <strong>How to switch providers:</strong>
                <br />
                {providersData.switchInstructions}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
