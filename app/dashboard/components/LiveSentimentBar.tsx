// F115: LiveSentimentBar component - real-time positive/neutral/negative
'use client'

import { useMemo } from 'react'

interface SentimentData {
  score: number // -1 to 1
  timestamp: string
}

interface LiveSentimentBarProps {
  sentiments: SentimentData[]
  showLabel?: boolean
  showPercentages?: boolean
  className?: string
}

export default function LiveSentimentBar({
  sentiments,
  showLabel = true,
  showPercentages = false,
  className = '',
}: LiveSentimentBarProps) {
  // Calculate sentiment distribution
  const distribution = useMemo(() => {
    if (sentiments.length === 0) {
      return {
        positive: 0,
        neutral: 0,
        negative: 0,
        positivePercent: 0,
        neutralPercent: 0,
        negativePercent: 0,
        overall: 0,
      }
    }

    let positive = 0
    let neutral = 0
    let negative = 0
    let totalScore = 0

    sentiments.forEach((s) => {
      totalScore += s.score
      if (s.score > 0.3) {
        positive++
      } else if (s.score < -0.3) {
        negative++
      } else {
        neutral++
      }
    })

    const total = sentiments.length
    const positivePercent = (positive / total) * 100
    const neutralPercent = (neutral / total) * 100
    const negativePercent = (negative / total) * 100
    const overall = totalScore / total

    return {
      positive,
      neutral,
      negative,
      positivePercent,
      neutralPercent,
      negativePercent,
      overall,
    }
  }, [sentiments])

  const overallLabel = useMemo(() => {
    if (distribution.overall > 0.3) return 'Positive'
    if (distribution.overall < -0.3) return 'Negative'
    return 'Neutral'
  }, [distribution.overall])

  const overallColor = useMemo(() => {
    if (distribution.overall > 0.3) return 'text-green-500'
    if (distribution.overall < -0.3) return 'text-red-500'
    return 'text-yellow-500'
  }, [distribution.overall])

  const overallBgColor = useMemo(() => {
    if (distribution.overall > 0.3) return 'bg-green-500'
    if (distribution.overall < -0.3) return 'bg-red-500'
    return 'bg-yellow-500'
  }, [distribution.overall])

  if (sentiments.length === 0) {
    return (
      <div className={className}>
        <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-gray-600 flex items-center justify-center">
            <span className="text-xs text-gray-400">No sentiment data yet</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">Overall Sentiment</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${overallColor}`}>
              {overallLabel}
            </span>
            <span className="text-xs text-gray-500">
              ({sentiments.length} {sentiments.length === 1 ? 'message' : 'messages'})
            </span>
          </div>
        </div>
      )}

      {/* Sentiment bar */}
      <div className="h-4 bg-gray-700 rounded-full overflow-hidden flex">
        {/* Positive segment */}
        {distribution.positivePercent > 0 && (
          <div
            className="bg-green-500 h-full transition-all duration-300 flex items-center justify-center"
            style={{ width: `${distribution.positivePercent}%` }}
            title={`Positive: ${distribution.positive} messages (${distribution.positivePercent.toFixed(1)}%)`}
          >
            {distribution.positivePercent > 10 && showPercentages && (
              <span className="text-xs font-semibold text-white">
                {distribution.positivePercent.toFixed(0)}%
              </span>
            )}
          </div>
        )}

        {/* Neutral segment */}
        {distribution.neutralPercent > 0 && (
          <div
            className="bg-yellow-500 h-full transition-all duration-300 flex items-center justify-center"
            style={{ width: `${distribution.neutralPercent}%` }}
            title={`Neutral: ${distribution.neutral} messages (${distribution.neutralPercent.toFixed(1)}%)`}
          >
            {distribution.neutralPercent > 10 && showPercentages && (
              <span className="text-xs font-semibold text-white">
                {distribution.neutralPercent.toFixed(0)}%
              </span>
            )}
          </div>
        )}

        {/* Negative segment */}
        {distribution.negativePercent > 0 && (
          <div
            className="bg-red-500 h-full transition-all duration-300 flex items-center justify-center"
            style={{ width: `${distribution.negativePercent}%` }}
            title={`Negative: ${distribution.negative} messages (${distribution.negativePercent.toFixed(1)}%)`}
          >
            {distribution.negativePercent > 10 && showPercentages && (
              <span className="text-xs font-semibold text-white">
                {distribution.negativePercent.toFixed(0)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      {showPercentages && (
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Positive ({distribution.positive})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Neutral ({distribution.neutral})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Negative ({distribution.negative})</span>
            </div>
          </div>
        </div>
      )}

      {/* Overall score indicator */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden relative">
          {/* Center marker */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-500"></div>

          {/* Score indicator */}
          <div
            className={`absolute top-0 bottom-0 w-1 ${overallBgColor} transition-all duration-300`}
            style={{
              left: `${((distribution.overall + 1) / 2) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          ></div>
        </div>
        <span className={`text-xs font-mono ${overallColor}`}>
          {distribution.overall >= 0 ? '+' : ''}
          {distribution.overall.toFixed(2)}
        </span>
      </div>
    </div>
  )
}
