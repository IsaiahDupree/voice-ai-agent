'use client'

import { useState, useEffect } from 'react'

// F0756: Dashboard tour - first-login guided tour
interface TourStep {
  target: string
  title: string
  description: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

const tourSteps: TourStep[] = [
  {
    target: 'search-bar',
    title: 'Quick Search',
    description: 'Use Ctrl+K to quickly search across all your calls, contacts, and campaigns.',
    position: 'bottom',
  },
  {
    target: 'notifications',
    title: 'Stay Updated',
    description: 'Get real-time alerts for dropped calls, failed bookings, and more.',
    position: 'bottom',
  },
  {
    target: 'theme-toggle',
    title: 'Customize Your Experience',
    description: 'Switch between light and dark themes, and choose your accent color in settings.',
    position: 'bottom',
  },
  {
    target: 'main-dashboard',
    title: 'Dashboard Overview',
    description: 'Monitor call analytics, booking rates, and campaign performance all in one place.',
    position: 'top',
  },
  {
    target: 'keyboard-shortcuts',
    title: 'Power User Tips',
    description: 'Press Shift+? anytime to see all available keyboard shortcuts.',
    position: 'bottom',
  },
]

export default function DashboardTour() {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasCompletedTour, setHasCompletedTour] = useState(true)

  useEffect(() => {
    // Check if user has completed the tour
    const completed = localStorage.getItem('dashboardTourCompleted')
    if (!completed) {
      setHasCompletedTour(false)
      // Start tour after a short delay
      setTimeout(() => setIsActive(true), 1000)
    }
  }, [])

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      completeTour()
    }
  }

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const skipTour = () => {
    setIsActive(false)
    localStorage.setItem('dashboardTourCompleted', 'true')
    setHasCompletedTour(true)
  }

  const completeTour = () => {
    setIsActive(false)
    localStorage.setItem('dashboardTourCompleted', 'true')
    setHasCompletedTour(true)
  }

  const restartTour = () => {
    setCurrentStep(0)
    setIsActive(true)
  }

  const step = tourSteps[currentStep]

  if (!isActive) {
    // Show "Start Tour" button if not completed
    return !hasCompletedTour ? (
      <button
        onClick={restartTour}
        className="fixed bottom-4 right-4 px-4 py-2 bg-primary text-white rounded-lg shadow-lg hover:bg-primary-dark transition-colors z-50"
      >
        Start Dashboard Tour
      </button>
    ) : null
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={skipTour} />

      {/* Tour Tooltip */}
      <div className="fixed z-50 max-w-sm animate-fadeIn" style={getTooltipPosition(step)}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary-dark p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{step.title}</h3>
              <button
                onClick={skipTour}
                className="text-white/80 hover:text-white transition-colors"
                aria-label="Skip tour"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1">
              {tourSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 flex-1 rounded-full ${
                    index === currentStep
                      ? 'bg-white'
                      : index < currentStep
                      ? 'bg-white/60'
                      : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">{step.description}</p>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {currentStep + 1} of {tourSteps.length}
            </span>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={previousStep}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Previous
                </button>
              )}
              <button
                onClick={nextStep}
                className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>

        {/* Pointer Arrow */}
        <div
          className={`absolute w-0 h-0 border-8 ${getArrowClasses(step.position)}`}
          style={getArrowPosition(step.position)}
        />
      </div>
    </>
  )
}

// Helper functions for positioning
function getTooltipPosition(step: TourStep): React.CSSProperties {
  // In a real implementation, this would calculate position based on the target element
  // For now, we'll use some default positions
  switch (step.target) {
    case 'search-bar':
      return { top: '80px', left: '50%', transform: 'translateX(-50%)' }
    case 'notifications':
      return { top: '80px', right: '100px' }
    case 'theme-toggle':
      return { top: '80px', right: '200px' }
    case 'main-dashboard':
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    case 'keyboard-shortcuts':
      return { top: '80px', right: '260px' }
    default:
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }
}

function getArrowClasses(position: 'top' | 'bottom' | 'left' | 'right'): string {
  switch (position) {
    case 'top':
      return 'border-t-white dark:border-t-gray-800 border-x-transparent border-b-transparent'
    case 'bottom':
      return 'border-b-white dark:border-b-gray-800 border-x-transparent border-t-transparent'
    case 'left':
      return 'border-l-white dark:border-l-gray-800 border-y-transparent border-r-transparent'
    case 'right':
      return 'border-r-white dark:border-r-gray-800 border-y-transparent border-l-transparent'
  }
}

function getArrowPosition(position: 'top' | 'bottom' | 'left' | 'right'): React.CSSProperties {
  switch (position) {
    case 'top':
      return { bottom: '-16px', left: '50%', transform: 'translateX(-50%)' }
    case 'bottom':
      return { top: '-16px', left: '50%', transform: 'translateX(-50%)' }
    case 'left':
      return { right: '-16px', top: '50%', transform: 'translateY(-50%)' }
    case 'right':
      return { left: '-16px', top: '50%', transform: 'translateY(-50%)' }
  }
}
