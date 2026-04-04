/**
 * Call Evaluation Dashboard
 * View LLM-judged call quality scores, trends, and improvement recommendations
 */

'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface EvaluationStats {
  total_evaluations: number
  average_overall_score: number
  average_goal_achievement_score: number
  average_naturalness_score: number
  average_objection_handling_score: number
  average_information_accuracy_score: number
  goal_achievement_rate: number
  common_failure_points: string[]
  top_improvement_suggestions: string[]
}

interface TrendDataPoint {
  date: string
  overall_score: number
  goal_score: number
  naturalness_score: number
}

export default function EvaluationDashboard() {
  const [stats, setStats] = useState<EvaluationStats | null>(null)
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    fetchStats()
  }, [dateRange])

  async function fetchStats() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        tenantId: 'default',
        startDate: dateRange.start,
        endDate: dateRange.end,
      })

      const response = await fetch(`/api/evaluation/aggregate?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch evaluation stats')
      }

      setStats(data)

      // Generate trend data (mock for now - in production, fetch from a daily aggregates table)
      generateTrendData(data)
    } catch (err: any) {
      console.error('Failed to fetch evaluation stats:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function generateTrendData(stats: EvaluationStats) {
    // Generate synthetic trend data
    // In production, this would come from a time-series aggregation
    const days = 30
    const trend: TrendDataPoint[] = []
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)

      // Simulate trend with some variance
      const variance = (Math.random() - 0.5) * 1.5
      trend.push({
        date: date.toISOString().split('T')[0],
        overall_score: Math.max(0, Math.min(10, stats.average_overall_score + variance)),
        goal_score: Math.max(0, Math.min(10, stats.average_goal_achievement_score + variance)),
        naturalness_score: Math.max(0, Math.min(10, stats.average_naturalness_score + variance)),
      })
    }

    setTrendData(trend)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8 flex items-center justify-center">
        <div className="text-xl">Loading evaluation data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Call Evaluation Dashboard</h1>
          <p className="text-gray-400">
            LLM-judged quality scores and improvement recommendations
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="mb-8 flex gap-4 items-center">
          <label className="text-sm text-gray-400">
            Start Date:
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="ml-2 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-gray-400">
            End Date:
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="ml-2 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
            />
          </label>
          <button
            onClick={fetchStats}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition"
          >
            Update
          </button>
        </div>

        {/* Score Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <ScoreCard
            title="Overall Score"
            score={stats.average_overall_score}
            total={10}
            color="blue"
          />
          <ScoreCard
            title="Goal Achievement"
            score={stats.average_goal_achievement_score}
            total={10}
            color="green"
          />
          <ScoreCard
            title="Naturalness"
            score={stats.average_naturalness_score}
            total={10}
            color="purple"
          />
          <ScoreCard
            title="Objection Handling"
            score={stats.average_objection_handling_score}
            total={10}
            color="orange"
          />
          <ScoreCard
            title="Information Accuracy"
            score={stats.average_information_accuracy_score}
            total={10}
            color="indigo"
          />
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-300">Goal Achievement Rate</h3>
            <div className="text-4xl font-bold text-green-400">{stats.goal_achievement_rate}%</div>
            <div className="text-sm text-gray-400 mt-2">
              {stats.total_evaluations} total evaluations
            </div>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6">Score Trends (30 Days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return `${date.getMonth() + 1}/${date.getDate()}`
                }}
              />
              <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 10]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  color: '#F3F4F6',
                }}
              />
              <Legend wrapperStyle={{ color: '#9CA3AF' }} />
              <Line
                type="monotone"
                dataKey="overall_score"
                stroke="#3B82F6"
                strokeWidth={2}
                name="Overall"
              />
              <Line
                type="monotone"
                dataKey="goal_score"
                stroke="#10B981"
                strokeWidth={2}
                name="Goal Achievement"
              />
              <Line
                type="monotone"
                dataKey="naturalness_score"
                stroke="#8B5CF6"
                strokeWidth={2}
                name="Naturalness"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Common Failure Points */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Common Failure Points</h2>
            {stats.common_failure_points.length > 0 ? (
              <ul className="space-y-3">
                {stats.common_failure_points.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center text-sm font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-gray-300">{point}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No common failure points detected</p>
            )}
          </div>

          {/* Top Improvement Suggestions */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Top Improvement Suggestions</h2>
            {stats.top_improvement_suggestions.length > 0 ? (
              <ul className="space-y-3">
                {stats.top_improvement_suggestions.map((suggestion, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-sm font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-gray-300">{suggestion}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No improvement suggestions available</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <a
            href="/dashboard"
            className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded font-medium transition"
          >
            Back to Dashboard
          </a>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded font-medium transition"
          >
            Refresh Data
          </button>
        </div>
      </div>
    </div>
  )
}

interface ScoreCardProps {
  title: string
  score: number
  total: number
  color: 'blue' | 'green' | 'purple' | 'orange' | 'indigo'
}

function ScoreCard({ title, score, total, color }: ScoreCardProps) {
  const percentage = (score / total) * 100

  const colorClasses = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    indigo: 'text-indigo-400',
  }

  const bgClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    indigo: 'bg-indigo-500',
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-2 text-gray-300">{title}</h3>
      <div className={`text-4xl font-bold ${colorClasses[color]}`}>
        {score.toFixed(1)}/{total}
      </div>

      {/* Progress Bar */}
      <div className="mt-4 w-full bg-gray-700 rounded-full h-2">
        <div
          className={`${bgClasses[color]} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-sm text-gray-400 mt-2">{percentage.toFixed(0)}%</div>
    </div>
  )
}
