'use client'

import { useState, useEffect } from 'react'

// F0745: Timezone selector for dashboard display
const commonTimezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8' },
  { value: 'America/Phoenix', label: 'Arizona Time (AZ)', offset: 'UTC-7' },
  { value: 'America/Anchorage', label: 'Alaska Time (AK)', offset: 'UTC-9' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HI)', offset: 'UTC-10' },
  { value: 'Europe/London', label: 'London (GMT)', offset: 'UTC+0' },
  { value: 'Europe/Paris', label: 'Central European (CET)', offset: 'UTC+1' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: 'UTC+4' },
  { value: 'Asia/Kolkata', label: 'India (IST)', offset: 'UTC+5:30' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: 'UTC+8' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 'UTC+9' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)', offset: 'UTC+11' },
]

export function TimezoneSelector() {
  const [timezone, setTimezone] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Load saved timezone or use browser's timezone
    const saved = localStorage.getItem('timezone')
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    setTimezone(saved || browserTz)
  }, [])

  const handleChange = (newTimezone: string) => {
    setTimezone(newTimezone)
    localStorage.setItem('timezone', newTimezone)
    // Trigger a custom event for other components to react
    window.dispatchEvent(new CustomEvent('timezoneChange', { detail: newTimezone }))
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Display Timezone
      </label>
      <select
        value={timezone}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
      >
        <optgroup label="North America">
          {commonTimezones.slice(0, 7).map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label} ({tz.offset})
            </option>
          ))}
        </optgroup>
        <optgroup label="Other">
          {commonTimezones.slice(7).map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label} ({tz.offset})
            </option>
          ))}
        </optgroup>
      </select>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Current time: {new Date().toLocaleString('en-US', { timeZone: timezone, timeStyle: 'short', dateStyle: 'short' })}
      </p>
    </div>
  )
}

// F0745: Hook to use timezone throughout the app
export function useTimezone() {
  const [timezone, setTimezone] = useState<string>('')

  useEffect(() => {
    // Get initial timezone
    const saved = localStorage.getItem('timezone')
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    setTimezone(saved || browserTz)

    // Listen for timezone changes
    const handleTimezoneChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      setTimezone(customEvent.detail)
    }

    window.addEventListener('timezoneChange', handleTimezoneChange)
    return () => window.removeEventListener('timezoneChange', handleTimezoneChange)
  }, [])

  const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleString('en-US', {
      timeZone: timezone,
      ...options,
    })
  }

  return { timezone, formatDate }
}
