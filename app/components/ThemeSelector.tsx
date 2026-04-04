'use client'

import { useTheme } from './ThemeProvider'
import { useEffect, useState } from 'react'

// F1446: Theme selector component for dashboard settings
export default function ThemeSelector() {
  const { theme, accentColor, toggleTheme, setAccentColor } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const accentColors = [
    { name: 'Blue', value: 'blue' as const, bg: 'bg-blue-500' },
    { name: 'Purple', value: 'purple' as const, bg: 'bg-purple-500' },
    { name: 'Green', value: 'green' as const, bg: 'bg-green-500' },
    { name: 'Orange', value: 'orange' as const, bg: 'bg-orange-500' },
    { name: 'Pink', value: 'pink' as const, bg: 'bg-pink-500' },
    { name: 'Red', value: 'red' as const, bg: 'bg-red-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Light/Dark Theme Toggle */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Theme Mode
        </h3>
        <button
          onClick={toggleTheme}
          className="relative inline-flex h-10 w-20 items-center rounded-full bg-gray-200 dark:bg-gray-700 transition-colors"
          aria-label="Toggle theme"
        >
          <span
            className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-lg transition-transform ${
              theme === 'dark' ? 'translate-x-11' : 'translate-x-1'
            }`}
          />
          <span className="absolute left-2 text-xs font-medium text-gray-600">
            {theme === 'light' ? '☀️' : '🌙'}
          </span>
        </button>
      </div>

      {/* Accent Color Selector */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Accent Color
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {accentColors.map((color) => (
            <button
              key={color.value}
              onClick={() => setAccentColor(color.value)}
              className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                accentColor === color.value
                  ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-800'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              aria-label={`Set ${color.name} accent color`}
            >
              <div className={`h-8 w-8 rounded-full ${color.bg}`} />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {color.name}
              </span>
              {accentColor === color.value && (
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Preview
        </h4>
        <div className="space-y-2">
          <button className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark transition-colors">
            Primary Button
          </button>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
              <div className="h-2 w-3/4 rounded-full bg-primary"></div>
            </div>
            <span className="text-xs text-primary font-medium">75%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
