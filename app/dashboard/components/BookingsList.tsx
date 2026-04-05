/**
 * Feature 219: BookingsList Component
 * Displays upcoming bookings from the active scheduling provider
 * Shows customer name, scheduled time, status, and actions
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Booking {
  id: string
  provider: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  start_time: string
  end_time: string
  timezone: string
  status: 'confirmed' | 'pending' | 'cancelled'
  notes?: string
  meeting_url?: string
  created_at: string
  updated_at: string
}

interface BookingsListProps {
  autoLoad?: boolean
  limit?: number
}

export function BookingsList({ autoLoad = true, limit = 10 }: BookingsListProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming')

  useEffect(() => {
    if (autoLoad) {
      fetchBookings()
    }
  }, [autoLoad, filter])

  const fetchBookings = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        filter,
      })

      const response = await fetch(`/api/scheduling/bookings?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch bookings')
      }

      setBookings(data.bookings || [])
    } catch (err: any) {
      console.error('Failed to fetch bookings:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const cancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) {
      return
    }

    try {
      const response = await fetch('/api/scheduling/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel booking')
      }

      // Refresh bookings list
      await fetchBookings()
    } catch (err: any) {
      console.error('Failed to cancel booking:', err)
      alert(`Error: ${err.message}`)
    }
  }

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-600">Confirmed</Badge>
      case 'pending':
        return <Badge className="bg-yellow-600">Pending</Badge>
      case 'cancelled':
        return <Badge className="bg-red-600">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const isUpcoming = (startTime: string) => {
    return new Date(startTime) > new Date()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Bookings</CardTitle>
            <CardDescription>
              Appointments from your active scheduling provider
            </CardDescription>
          </div>
          <Button onClick={fetchBookings} variant="outline" size="sm" disabled={loading}>
            {loading ? '⏳' : '🔄'} Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 text-sm rounded ${
              filter === 'upcoming'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-4 py-2 text-sm rounded ${
              filter === 'past'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Past
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm rounded ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8 text-gray-500">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <p className="mt-2">Loading bookings...</p>
          </div>
        )}

        {/* Bookings List */}
        {!loading && bookings.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg mb-2">📅</p>
            <p>No bookings found</p>
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className={`p-4 border rounded-lg ${
                  booking.status === 'cancelled'
                    ? 'bg-gray-50 border-gray-300'
                    : 'border-gray-200 hover:border-blue-400 transition'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">
                        {booking.customer_name}
                      </h3>
                      {getStatusBadge(booking.status)}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <span>📅</span>
                        <span>{formatDateTime(booking.start_time)}</span>
                      </div>
                      {booking.customer_email && (
                        <div className="flex items-center gap-2">
                          <span>📧</span>
                          <span>{booking.customer_email}</span>
                        </div>
                      )}
                      {booking.customer_phone && (
                        <div className="flex items-center gap-2">
                          <span>📱</span>
                          <span>{booking.customer_phone}</span>
                        </div>
                      )}
                      {booking.notes && (
                        <div className="flex items-start gap-2 mt-2">
                          <span>📝</span>
                          <span className="text-gray-700">{booking.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {booking.status !== 'cancelled' && isUpcoming(booking.start_time) && (
                    <div className="flex flex-col gap-2 ml-4">
                      {booking.meeting_url && (
                        <a
                          href={booking.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition text-center"
                        >
                          Join Meeting
                        </a>
                      )}
                      <button
                        onClick={() => cancelBooking(booking.id)}
                        className="px-3 py-1 border border-red-300 text-red-700 text-sm rounded hover:bg-red-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                  <span>Provider: {booking.provider}</span>
                  <span>Booked: {formatDateTime(booking.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
