'use client'

import { useState } from 'react'

interface DateRange {
  startDate: string
  endDate: string
}

interface DateRangePickerProps {
  onDateRangeChange: (range: DateRange) => void
  defaultDays?: number
}

export default function DateRangePicker({ onDateRangeChange, defaultDays = 30 }: DateRangePickerProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - defaultDays)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const handleApply = () => {
    onDateRangeChange({ startDate, endDate })
    setShowPicker(false)
  }

  const handlePreset = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)

    const newRange = {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    }

    setStartDate(newRange.startDate)
    setEndDate(newRange.endDate)
    onDateRangeChange(newRange)
    setShowPicker(false)
  }

  const formatDisplay = () => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="px-4 py-2 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 transition flex items-center gap-2"
      >
        <span className="text-sm">{formatDisplay()}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {showPicker && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 z-50">
          <div className="space-y-4">
            {/* Preset buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handlePreset(7)}
                className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm transition"
              >
                Last 7 days
              </button>
              <button
                onClick={() => handlePreset(30)}
                className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm transition"
              >
                Last 30 days
              </button>
              <button
                onClick={() => handlePreset(90)}
                className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm transition"
              >
                Last 90 days
              </button>
            </div>

            {/* Custom date inputs */}
            <div className="border-t border-gray-700 pt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="border-t border-gray-700 pt-4 flex gap-2">
              <button
                onClick={handleApply}
                className="flex-1 px-3 py-2 bg-blue-600 rounded hover:bg-blue-700 transition font-medium text-sm"
              >
                Apply
              </button>
              <button
                onClick={() => setShowPicker(false)}
                className="flex-1 px-3 py-2 bg-gray-700 rounded hover:bg-gray-600 transition font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
