// F0851: Analytics comparison - compare metrics across time periods

export interface AnalyticsMetrics {
  total_calls: number
  completed_calls: number
  answer_rate: number
  avg_duration: number
  bookings_made: number
  booking_rate: number
  sentiment_breakdown: {
    positive: number
    neutral: number
    negative: number
  }
  transfer_rate: number
  avg_quality_score: number
}

export interface PeriodComparison {
  current: AnalyticsMetrics
  previous: AnalyticsMetrics
  changes: {
    total_calls: { value: number; percent: number }
    answer_rate: { value: number; percent: number }
    avg_duration: { value: number; percent: number }
    booking_rate: { value: number; percent: number }
    transfer_rate: { value: number; percent: number }
    avg_quality_score: { value: number; percent: number }
  }
  trend: 'improving' | 'declining' | 'stable'
}

/**
 * F0851: Calculate percentage change between two values
 */
export function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/**
 * F0851: Compare analytics between two time periods
 */
export function compareAnalyticsPeriods(
  current: AnalyticsMetrics,
  previous: AnalyticsMetrics
): PeriodComparison {
  const changes = {
    total_calls: {
      value: current.total_calls - previous.total_calls,
      percent: calculatePercentChange(current.total_calls, previous.total_calls),
    },
    answer_rate: {
      value: current.answer_rate - previous.answer_rate,
      percent: calculatePercentChange(current.answer_rate, previous.answer_rate),
    },
    avg_duration: {
      value: current.avg_duration - previous.avg_duration,
      percent: calculatePercentChange(current.avg_duration, previous.avg_duration),
    },
    booking_rate: {
      value: current.booking_rate - previous.booking_rate,
      percent: calculatePercentChange(current.booking_rate, previous.booking_rate),
    },
    transfer_rate: {
      value: current.transfer_rate - previous.transfer_rate,
      percent: calculatePercentChange(current.transfer_rate, previous.transfer_rate),
    },
    avg_quality_score: {
      value: current.avg_quality_score - previous.avg_quality_score,
      percent: calculatePercentChange(current.avg_quality_score, previous.avg_quality_score),
    },
  }

  // Determine overall trend
  let improvingCount = 0
  let decliningCount = 0

  // Metrics where higher is better
  const higherIsBetter = [
    'total_calls',
    'answer_rate',
    'booking_rate',
    'avg_quality_score',
  ]

  // Metrics where lower is better
  const lowerIsBetter = ['transfer_rate']

  Object.entries(changes).forEach(([key, change]) => {
    if (higherIsBetter.includes(key)) {
      if (change.value > 0) improvingCount++
      else if (change.value < 0) decliningCount++
    } else if (lowerIsBetter.includes(key)) {
      if (change.value < 0) improvingCount++
      else if (change.value > 0) decliningCount++
    }
  })

  const trend: 'improving' | 'declining' | 'stable' =
    improvingCount > decliningCount
      ? 'improving'
      : decliningCount > improvingCount
      ? 'declining'
      : 'stable'

  return {
    current,
    previous,
    changes,
    trend,
  }
}

/**
 * F0851: Format comparison for display
 */
export function formatComparison(comparison: PeriodComparison): string {
  const lines: string[] = [
    `Analytics Comparison (${comparison.trend.toUpperCase()})`,
    '',
    `Total Calls: ${comparison.current.total_calls} (${comparison.changes.total_calls.value >= 0 ? '+' : ''}${comparison.changes.total_calls.value}, ${comparison.changes.total_calls.percent.toFixed(1)}%)`,
    `Answer Rate: ${comparison.current.answer_rate.toFixed(1)}% (${comparison.changes.answer_rate.value >= 0 ? '+' : ''}${comparison.changes.answer_rate.value.toFixed(1)}pp)`,
    `Booking Rate: ${comparison.current.booking_rate.toFixed(1)}% (${comparison.changes.booking_rate.value >= 0 ? '+' : ''}${comparison.changes.booking_rate.value.toFixed(1)}pp)`,
    `Avg Duration: ${comparison.current.avg_duration.toFixed(0)}s (${comparison.changes.avg_duration.value >= 0 ? '+' : ''}${comparison.changes.avg_duration.value.toFixed(0)}s)`,
    `Quality Score: ${comparison.current.avg_quality_score.toFixed(0)}/100 (${comparison.changes.avg_quality_score.value >= 0 ? '+' : ''}${comparison.changes.avg_quality_score.value.toFixed(0)})`,
  ]

  return lines.join('\n')
}
