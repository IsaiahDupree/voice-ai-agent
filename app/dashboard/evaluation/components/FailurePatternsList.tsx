/**
 * FailurePatternsList Component
 * Aggregates and displays common failure patterns across multiple call evaluations
 */

'use client'

import { useState, useEffect } from 'react'

interface FailurePattern {
  pattern: string
  occurrences: number
  percentage: number
  relatedCalls: string[]
}

interface FailurePatternsListProps {
  tenantId?: string
  startDate?: string
  endDate?: string
  limit?: number
}

export default function FailurePatternsList({
  tenantId = 'default',
  startDate,
  endDate,
  limit = 10,
}: FailurePatternsListProps) {
  const [patterns, setPatterns] = useState<FailurePattern[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPattern, setSelectedPattern] = useState<FailurePattern | null>(null)

  useEffect(() => {
    fetchFailurePatterns()
  }, [tenantId, startDate, endDate])

  async function fetchFailurePatterns() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        tenantId,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      })

      const response = await fetch(`/api/evaluation/aggregate?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch failure patterns')
      }

      // Process common_failure_points into pattern objects
      const failurePoints = data.common_failure_points || []
      const totalEvaluations = data.total_evaluations || 1

      // In a real implementation, we would group similar patterns
      // For now, we'll create a pattern object for each unique failure point
      const processedPatterns: FailurePattern[] = failurePoints.map(
        (point: string, idx: number) => {
          // Simulate occurrence count (in production, fetch from aggregated data)
          const occurrences = Math.max(1, totalEvaluations - idx * 2)
          return {
            pattern: point,
            occurrences,
            percentage: (occurrences / totalEvaluations) * 100,
            relatedCalls: [], // In production, fetch actual call IDs
          }
        }
      )

      setPatterns(processedPatterns.slice(0, limit))
    } catch (err: any) {
      console.error('Failed to fetch failure patterns:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-white">Common Failure Patterns</h2>
        <div className="text-gray-400">Loading failure patterns...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-800 border border-red-500/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-white">Common Failure Patterns</h2>
        <div className="text-red-400">Error: {error}</div>
      </div>
    )
  }

  if (patterns.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-white">Common Failure Patterns</h2>
        <div className="text-gray-400">
          No failure patterns detected. Great job! 🎉
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Common Failure Patterns</h2>
        <span className="text-sm text-gray-400">{patterns.length} patterns found</span>
      </div>

      <div className="space-y-3">
        {patterns.map((pattern, idx) => (
          <div
            key={idx}
            className={`border border-gray-700 rounded-lg p-4 transition cursor-pointer ${
              selectedPattern === pattern
                ? 'bg-red-500/10 border-red-500'
                : 'hover:bg-gray-700/50 hover:border-gray-600'
            }`}
            onClick={() => setSelectedPattern(selectedPattern === pattern ? null : pattern)}
          >
            <div className="flex items-start justify-between gap-4">
              {/* Rank Badge */}
              <div className="flex-shrink-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                    idx === 0
                      ? 'bg-red-500 text-white'
                      : idx === 1
                      ? 'bg-orange-500 text-white'
                      : idx === 2
                      ? 'bg-yellow-500 text-gray-900'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {idx + 1}
                </div>
              </div>

              {/* Pattern Content */}
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium mb-2">{pattern.pattern}</div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-red-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, pattern.percentage)}%` }}
                  />
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-400">
                    {pattern.occurrences} occurrence{pattern.occurrences !== 1 ? 's' : ''}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-red-400 font-medium">
                    {pattern.percentage.toFixed(1)}% of calls
                  </span>
                </div>
              </div>

              {/* Expand Arrow */}
              <div className="flex-shrink-0">
                <div
                  className={`text-gray-400 transition-transform ${
                    selectedPattern === pattern ? 'rotate-180' : ''
                  }`}
                >
                  ▼
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {selectedPattern === pattern && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">
                  Recommendations to fix this pattern:
                </h4>
                <ul className="space-y-1 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">→</span>
                    <span>Review and update system prompt to handle this scenario</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">→</span>
                    <span>Add specific training examples or function tools</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">→</span>
                    <span>Test response variations in playground before deploying</span>
                  </li>
                </ul>

                {pattern.relatedCalls.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Related Calls:</h4>
                    <div className="flex flex-wrap gap-2">
                      {pattern.relatedCalls.map((callId) => (
                        <a
                          key={callId}
                          href={`/dashboard/calls/${callId}`}
                          className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-blue-400 transition"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {callId.substring(0, 8)}...
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Footer */}
      <div className="mt-6 pt-6 border-t border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-400">
            Focus on fixing the top 3 patterns for maximum impact
          </div>
          <button
            onClick={fetchFailurePatterns}
            className="text-blue-400 hover:text-blue-300 font-medium transition"
          >
            Refresh Data
          </button>
        </div>
      </div>
    </div>
  )
}
