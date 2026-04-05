/**
 * Feature 218: AvailabilityTester Component
 * Interactive date range picker → fetch and display available slots from active provider
 * Allows testing scheduling provider availability API
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TimeSlot {
  start: string
  end: string
  available: boolean
  timezone: string
}

interface AvailabilityResult {
  slots: TimeSlot[]
  timezone: string
  duration_minutes: number
  provider: string
}

export function AvailabilityTester() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AvailabilityResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkAvailability = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/scheduling/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          timezone,
          duration_minutes: durationMinutes,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check availability')
      }

      setResult(data)
    } catch (err: any) {
      console.error('Availability check error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const getDefaultStartDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    return tomorrow.toISOString().slice(0, 16)
  }

  const getDefaultEndDate = () => {
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    nextWeek.setHours(17, 0, 0, 0)
    return nextWeek.toISOString().slice(0, 16)
  }

  const availableSlots = result?.slots.filter((slot) => slot.available) || []
  const busySlots = result?.slots.filter((slot) => !slot.available) || []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Availability Tester</CardTitle>
        <CardDescription>
          Check available appointment slots from your active scheduling provider
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date & Time</Label>
            <Input
              id="start-date"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder={getDefaultStartDate()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-date">End Date & Time</Label>
            <Input
              id="end-date"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder={getDefaultEndDate()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="America/New_York">Eastern (ET)</option>
              <option value="America/Chicago">Central (CT)</option>
              <option value="America/Denver">Mountain (MT)</option>
              <option value="America/Los_Angeles">Pacific (PT)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 30)}
              min={15}
              max={240}
              step={15}
            />
          </div>
        </div>

        {/* Check Button */}
        <Button
          onClick={checkAvailability}
          disabled={loading}
          className="w-full"
        >
          {loading ? '⏳ Checking Availability...' : '🔍 Check Availability'}
        </Button>

        {/* Quick Preset Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setStartDate(getDefaultStartDate())
              setEndDate(getDefaultEndDate())
            }}
            variant="outline"
            size="sm"
          >
            📅 Next 7 Days
          </Button>
          <Button
            onClick={() => {
              const today = new Date()
              today.setHours(9, 0, 0, 0)
              const endOfDay = new Date()
              endOfDay.setHours(17, 0, 0, 0)
              setStartDate(today.toISOString().slice(0, 16))
              setEndDate(endOfDay.toISOString().slice(0, 16))
            }}
            variant="outline"
            size="sm"
          >
            🕒 Today
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded">
              <div className="text-sm">
                <span className="font-semibold">Provider:</span>{' '}
                <span className="text-gray-700">{result.provider}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">Total Slots:</span>{' '}
                <span className="text-gray-700">{result.slots.length}</span>
              </div>
            </div>

            {/* Available Slots */}
            <div>
              <h3 className="font-semibold text-sm mb-2 text-green-700">
                ✓ Available Slots ({availableSlots.length})
              </h3>
              {availableSlots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                  {availableSlots.map((slot, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-green-50 border border-green-200 rounded text-sm"
                    >
                      <div className="font-medium">{formatDateTime(slot.start)}</div>
                      <div className="text-xs text-gray-600">
                        {result.duration_minutes} min
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No available slots in this range</p>
              )}
            </div>

            {/* Busy Slots */}
            {busySlots.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2 text-red-700">
                  ✗ Busy/Unavailable ({busySlots.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                  {busySlots.slice(0, 10).map((slot, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-red-50 border border-red-200 rounded text-sm"
                    >
                      <div className="font-medium">{formatDateTime(slot.start)}</div>
                      <div className="text-xs text-gray-600">Unavailable</div>
                    </div>
                  ))}
                </div>
                {busySlots.length > 10 && (
                  <p className="text-xs text-gray-500 mt-1">
                    ... and {busySlots.length - 10} more
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
