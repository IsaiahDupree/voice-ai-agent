/**
 * EvalScoreCard Component
 * Displays detailed evaluation for a single call with all 5 scores and recommendations
 */

'use client'

interface EvalScoreCardProps {
  call_id: string
  goal_achieved: boolean
  goal_achievement_score: number
  naturalness_score: number
  objection_handling_score: number
  information_accuracy_score: number
  overall_score: number
  failure_points: string[]
  improvement_suggestions: string[]
  highlight_moments: string[]
  recommended_prompt_changes: string[]
  createdAt?: string
}

export default function EvalScoreCard(props: EvalScoreCardProps) {
  const {
    call_id,
    goal_achieved,
    goal_achievement_score,
    naturalness_score,
    objection_handling_score,
    information_accuracy_score,
    overall_score,
    failure_points,
    improvement_suggestions,
    highlight_moments,
    recommended_prompt_changes,
    createdAt,
  } = props

  // Determine overall status color
  const getStatusColor = (score: number) => {
    if (score >= 8) return 'green'
    if (score >= 6) return 'yellow'
    if (score >= 4) return 'orange'
    return 'red'
  }

  const statusColor = getStatusColor(overall_score)

  const statusClasses = {
    green: 'bg-green-500/10 border-green-500 text-green-400',
    yellow: 'bg-yellow-500/10 border-yellow-500 text-yellow-400',
    orange: 'bg-orange-500/10 border-orange-500 text-orange-400',
    red: 'bg-red-500/10 border-red-500 text-red-400',
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-white">Call: {call_id.substring(0, 12)}...</h3>
            {goal_achieved ? (
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                ✓ Goal Achieved
              </span>
            ) : (
              <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
                ✗ Goal Not Achieved
              </span>
            )}
          </div>
          {createdAt && (
            <div className="text-sm text-gray-400">
              Evaluated: {new Date(createdAt).toLocaleString()}
            </div>
          )}
        </div>
        <div
          className={`px-6 py-3 rounded-lg border-2 ${statusClasses[statusColor]} font-bold text-2xl`}
        >
          {overall_score.toFixed(1)}/10
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <ScoreBadge label="Goal Achievement" score={goal_achievement_score} icon="🎯" />
        <ScoreBadge label="Naturalness" score={naturalness_score} icon="💬" />
        <ScoreBadge label="Objection Handling" score={objection_handling_score} icon="🛡️" />
        <ScoreBadge label="Information Accuracy" score={information_accuracy_score} icon="✓" />
        <ScoreBadge label="Overall" score={overall_score} icon="⭐" />
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {/* Highlight Moments */}
        {highlight_moments.length > 0 && (
          <Section title="✨ Highlights" color="green">
            <ul className="space-y-2">
              {highlight_moments.map((moment, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">•</span>
                  <span className="text-gray-300">{moment}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Failure Points */}
        {failure_points.length > 0 && (
          <Section title="⚠️ Failure Points" color="red">
            <ul className="space-y-2">
              {failure_points.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span className="text-gray-300">{point}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Improvement Suggestions */}
        {improvement_suggestions.length > 0 && (
          <Section title="💡 Improvement Suggestions" color="blue">
            <ul className="space-y-2">
              {improvement_suggestions.map((suggestion, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span className="text-gray-300">{suggestion}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Recommended Prompt Changes */}
        {recommended_prompt_changes.length > 0 && (
          <Section title="📝 Recommended Prompt Changes" color="purple">
            <ul className="space-y-2">
              {recommended_prompt_changes.map((change, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-purple-400 mt-1">•</span>
                  <span className="text-gray-300">{change}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* View Call Button */}
      <div className="mt-6 pt-6 border-t border-gray-700">
        <a
          href={`/dashboard/calls/${call_id}`}
          className="inline-block bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition"
        >
          View Full Call Details →
        </a>
      </div>
    </div>
  )
}

interface ScoreBadgeProps {
  label: string
  score: number
  icon: string
}

function ScoreBadge({ label, score, icon }: ScoreBadgeProps) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400'
    if (score >= 6) return 'text-yellow-400'
    if (score >= 4) return 'text-orange-400'
    return 'text-red-400'
  }

  return (
    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${getScoreColor(score)}`}>{score.toFixed(1)}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  )
}

interface SectionProps {
  title: string
  color: 'green' | 'red' | 'blue' | 'purple'
  children: React.ReactNode
}

function Section({ title, color, children }: SectionProps) {
  const borderClasses = {
    green: 'border-green-500/30',
    red: 'border-red-500/30',
    blue: 'border-blue-500/30',
    purple: 'border-purple-500/30',
  }

  return (
    <div className={`border-l-4 ${borderClasses[color]} pl-4`}>
      <h4 className="text-lg font-semibold mb-3 text-white">{title}</h4>
      {children}
    </div>
  )
}
