'use client'

import { useState, useEffect } from 'react'

// F1443: Dashboard onboarding checklist
interface ChecklistItem {
  id: string
  title: string
  description: string
  completed: boolean
  actionUrl?: string
  actionLabel?: string
}

const initialChecklist: Omit<ChecklistItem, 'completed'>[] = [
  {
    id: 'create-persona',
    title: 'Create your first AI agent persona',
    description: 'Configure voice, personality, and script for your AI phone agent',
    actionUrl: '/dashboard/personas',
    actionLabel: 'Create Persona',
  },
  {
    id: 'connect-calendar',
    title: 'Connect your calendar',
    description: 'Link Cal.com to enable appointment booking during calls',
    actionUrl: '/dashboard/settings',
    actionLabel: 'Connect Calendar',
  },
  {
    id: 'setup-phone',
    title: 'Get a phone number',
    description: 'Purchase or port a phone number for inbound calls',
    actionUrl: '/dashboard/numbers',
    actionLabel: 'Get Number',
  },
  {
    id: 'test-call',
    title: 'Make a test call',
    description: 'Test your agent by calling yourself or a test number',
    actionUrl: '/dashboard?test=true',
    actionLabel: 'Start Test',
  },
  {
    id: 'create-campaign',
    title: 'Launch your first campaign',
    description: 'Upload contacts and start making outbound calls at scale',
    actionUrl: '/dashboard/campaigns',
    actionLabel: 'Create Campaign',
  },
]

export default function OnboardingChecklist() {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // Load checklist state from localStorage
    const saved = localStorage.getItem('onboardingChecklist')
    const dismissed = localStorage.getItem('onboardingChecklistDismissed')

    if (dismissed === 'true') {
      setIsDismissed(true)
      return
    }

    if (saved) {
      setChecklist(JSON.parse(saved))
    } else {
      setChecklist(initialChecklist.map((item) => ({ ...item, completed: false })))
    }
  }, [])

  const toggleItem = (id: string) => {
    const updated = checklist.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    )
    setChecklist(updated)
    localStorage.setItem('onboardingChecklist', JSON.stringify(updated))
  }

  const dismissChecklist = () => {
    setIsDismissed(true)
    localStorage.setItem('onboardingChecklistDismissed', 'true')
  }

  const resetChecklist = () => {
    const reset = initialChecklist.map((item) => ({ ...item, completed: false }))
    setChecklist(reset)
    localStorage.setItem('onboardingChecklist', JSON.stringify(reset))
    localStorage.removeItem('onboardingChecklistDismissed')
    setIsDismissed(false)
  }

  const completedCount = checklist.filter((item) => item.completed).length
  const totalCount = checklist.length
  const progress = (completedCount / totalCount) * 100

  if (isDismissed) {
    return null
  }

  if (completedCount === totalCount && checklist.length > 0) {
    return (
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold">You're all set!</h3>
              <p className="text-white/90 mt-1">
                Great job completing the onboarding. You're ready to scale your voice AI operations.
              </p>
            </div>
          </div>
          <button
            onClick={dismissChecklist}
            className="text-white/80 hover:text-white transition-colors"
            aria-label="Dismiss checklist"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Get Started
              </h3>
              <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
                {completedCount} of {totalCount}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Complete these steps to get your voice AI agent up and running
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={isCollapsed ? 'Expand checklist' : 'Collapse checklist'}
            >
              <svg
                className={`h-5 w-5 text-gray-500 transition-transform ${
                  isCollapsed ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={dismissChecklist}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Dismiss checklist"
            >
              <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-dark transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Checklist Items */}
      {!isCollapsed && (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {checklist.map((item) => (
            <div
              key={item.id}
              className={`p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                item.completed ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <button
                  onClick={() => toggleItem(item.id)}
                  className={`flex-shrink-0 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${
                    item.completed
                      ? 'bg-primary border-primary'
                      : 'border-gray-300 dark:border-gray-600 hover:border-primary'
                  }`}
                  aria-label={item.completed ? 'Mark as incomplete' : 'Mark as complete'}
                >
                  {item.completed && (
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1">
                  <h4 className={`font-medium ${item.completed ? 'line-through text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                    {item.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {item.description}
                  </p>
                </div>

                {/* Action Button */}
                {!item.completed && item.actionUrl && (
                  <a
                    href={item.actionUrl}
                    className="flex-shrink-0 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    {item.actionLabel}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
