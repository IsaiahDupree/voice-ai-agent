// F116: CallStageIndicator component - Greeting → Discovery → Pitch → Close
'use client'

type CallStage = 'greeting' | 'discovery' | 'pitch' | 'objections' | 'close' | 'ended'

interface CallStageIndicatorProps {
  currentStage: CallStage
  compact?: boolean
  showLabels?: boolean
  className?: string
}

const stages: { id: CallStage; label: string; icon: string }[] = [
  { id: 'greeting', label: 'Greeting', icon: '👋' },
  { id: 'discovery', label: 'Discovery', icon: '🔍' },
  { id: 'pitch', label: 'Pitch', icon: '💡' },
  { id: 'objections', label: 'Objections', icon: '⚡' },
  { id: 'close', label: 'Close', icon: '✅' },
]

export default function CallStageIndicator({
  currentStage,
  compact = false,
  showLabels = true,
  className = '',
}: CallStageIndicatorProps) {
  const currentIndex = stages.findIndex((s) => s.id === currentStage)
  const isEnded = currentStage === 'ended'

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-1.5">
          {stages.map((stage, index) => {
            const isActive = index === currentIndex
            const isPast = index < currentIndex
            const isCurrent = index === currentIndex

            return (
              <div
                key={stage.id}
                className={`flex items-center ${index < stages.length - 1 ? 'gap-1.5' : ''}`}
              >
                {/* Stage dot */}
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    isPast
                      ? 'bg-green-500'
                      : isCurrent
                      ? 'bg-blue-500 ring-2 ring-blue-400 ring-opacity-50'
                      : 'bg-gray-600'
                  }`}
                  title={stage.label}
                ></div>

                {/* Connector line */}
                {index < stages.length - 1 && (
                  <div
                    className={`h-0.5 w-4 ${
                      isPast ? 'bg-green-500' : 'bg-gray-600'
                    } transition-all`}
                  ></div>
                )}
              </div>
            )
          })}
        </div>
        {showLabels && (
          <span className="text-sm font-medium text-gray-300">
            {isEnded ? 'Ended' : stages[currentIndex]?.label || 'Unknown'}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={className}>
      {showLabels && (
        <div className="mb-3">
          <span className="text-sm font-medium text-gray-400">Call Stage</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        {stages.map((stage, index) => {
          const isActive = index === currentIndex
          const isPast = index < currentIndex
          const isCurrent = index === currentIndex
          const isFuture = index > currentIndex

          return (
            <div
              key={stage.id}
              className={`flex flex-col items-center flex-1 ${
                index < stages.length - 1 ? 'relative' : ''
              }`}
            >
              {/* Stage circle */}
              <div className="relative z-10 mb-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isPast
                      ? 'bg-green-600 text-white'
                      : isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-500 ring-opacity-30'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {isPast ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="text-lg">{stage.icon}</span>
                  )}
                </div>

                {/* Pulse animation for current stage */}
                {isCurrent && (
                  <span className="absolute inset-0 rounded-full">
                    <span className="animate-ping absolute inset-0 rounded-full bg-blue-400 opacity-75"></span>
                  </span>
                )}
              </div>

              {/* Label */}
              {showLabels && (
                <span
                  className={`text-xs font-medium text-center ${
                    isPast
                      ? 'text-green-400'
                      : isCurrent
                      ? 'text-blue-400'
                      : 'text-gray-500'
                  }`}
                >
                  {stage.label}
                </span>
              )}

              {/* Connector line */}
              {index < stages.length - 1 && (
                <div
                  className={`absolute top-5 left-1/2 w-full h-0.5 -z-0 transition-all ${
                    isPast ? 'bg-green-600' : 'bg-gray-700'
                  }`}
                  style={{
                    width: 'calc(100% - 40px)',
                    marginLeft: '20px',
                  }}
                ></div>
              )}
            </div>
          )
        })}
      </div>

      {/* Ended state overlay */}
      {isEnded && (
        <div className="mt-4 p-3 bg-gray-800 border border-gray-700 rounded text-center">
          <span className="text-sm font-medium text-gray-400">Call Ended</span>
        </div>
      )}
    </div>
  )
}

// Utility function to detect stage from transcript
export function detectCallStage(messages: { role: string; content: string }[]): CallStage {
  if (messages.length === 0) return 'greeting'

  const allText = messages.map((m) => m.content.toLowerCase()).join(' ')

  // Simple keyword-based detection (can be enhanced with AI/LLM classification)
  if (messages.length <= 3) return 'greeting'

  if (
    allText.includes('question') ||
    allText.includes('tell me') ||
    allText.includes('what') ||
    allText.includes('how') ||
    allText.includes('when')
  ) {
    return 'discovery'
  }

  if (
    allText.includes('offer') ||
    allText.includes('solution') ||
    allText.includes('help you') ||
    allText.includes('we can') ||
    allText.includes('pricing') ||
    allText.includes('plan')
  ) {
    return 'pitch'
  }

  if (
    allText.includes('but') ||
    allText.includes('however') ||
    allText.includes('concern') ||
    allText.includes('worried') ||
    allText.includes('not sure')
  ) {
    return 'objections'
  }

  if (
    allText.includes('book') ||
    allText.includes('schedule') ||
    allText.includes('confirm') ||
    allText.includes('agree') ||
    allText.includes('sign up') ||
    allText.includes('next steps')
  ) {
    return 'close'
  }

  // Default to discovery if we can't determine
  return 'discovery'
}
