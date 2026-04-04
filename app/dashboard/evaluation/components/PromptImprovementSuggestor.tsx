/**
 * PromptImprovementSuggestor Component
 * Aggregates and displays recommended prompt changes from call evaluations
 * Helps iterate on system prompts based on LLM-judged feedback
 */

'use client'

import { useState, useEffect } from 'react'

interface PromptSuggestion {
  suggestion: string
  occurrences: number
  priority: 'high' | 'medium' | 'low'
  category: 'tone' | 'clarity' | 'completeness' | 'handling' | 'other'
  relatedFailures: string[]
  appliedAt?: string
}

interface PromptImprovementSuggestorProps {
  tenantId?: string
  startDate?: string
  endDate?: string
  assistantId?: string
}

export default function PromptImprovementSuggestor({
  tenantId = 'default',
  startDate,
  endDate,
  assistantId,
}: PromptImprovementSuggestorProps) {
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  useEffect(() => {
    fetchSuggestions()
  }, [tenantId, startDate, endDate, assistantId])

  async function fetchSuggestions() {
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
        throw new Error(data.error || 'Failed to fetch suggestions')
      }

      // Process recommended_prompt_changes into suggestion objects
      const promptChanges = data.top_improvement_suggestions || []

      // Categorize and prioritize suggestions
      const processedSuggestions: PromptSuggestion[] = promptChanges.map(
        (suggestion: string, idx: number) => {
          const category = categorizeSuggestion(suggestion)
          const priority = idx < 3 ? 'high' : idx < 6 ? 'medium' : 'low'
          const occurrences = Math.max(1, promptChanges.length - idx)

          return {
            suggestion,
            occurrences,
            priority,
            category,
            relatedFailures: [], // In production, fetch related failure patterns
          }
        }
      )

      setSuggestions(processedSuggestions)
    } catch (err: any) {
      console.error('Failed to fetch prompt suggestions:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function categorizeSuggestion(suggestion: string): PromptSuggestion['category'] {
    const lower = suggestion.toLowerCase()

    if (lower.includes('tone') || lower.includes('polite') || lower.includes('friendly')) {
      return 'tone'
    }
    if (lower.includes('clear') || lower.includes('confus') || lower.includes('explain')) {
      return 'clarity'
    }
    if (lower.includes('objection') || lower.includes('handle') || lower.includes('respond')) {
      return 'handling'
    }
    if (lower.includes('add') || lower.includes('include') || lower.includes('mention')) {
      return 'completeness'
    }

    return 'other'
  }

  function copySuggestion(suggestion: string, index: number) {
    navigator.clipboard.writeText(suggestion)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const filteredSuggestions =
    selectedCategory === 'all'
      ? suggestions
      : suggestions.filter((s) => s.category === selectedCategory)

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-white">Prompt Improvement Suggestions</h2>
        <div className="text-gray-400">Loading suggestions...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-800 border border-red-500/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-white">Prompt Improvement Suggestions</h2>
        <div className="text-red-400">Error: {error}</div>
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-white">Prompt Improvement Suggestions</h2>
        <div className="text-gray-400">
          No prompt improvements suggested. Your prompts are optimized! ✨
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Prompt Improvement Suggestions</h2>
          <p className="text-sm text-gray-400">
            Based on {suggestions.reduce((sum, s) => sum + s.occurrences, 0)} evaluation
            recommendations
          </p>
        </div>
        <button
          onClick={fetchSuggestions}
          className="text-blue-400 hover:text-blue-300 font-medium text-sm transition"
        >
          Refresh
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <CategoryButton
          label="All"
          active={selectedCategory === 'all'}
          count={suggestions.length}
          onClick={() => setSelectedCategory('all')}
        />
        <CategoryButton
          label="Tone"
          active={selectedCategory === 'tone'}
          count={suggestions.filter((s) => s.category === 'tone').length}
          onClick={() => setSelectedCategory('tone')}
        />
        <CategoryButton
          label="Clarity"
          active={selectedCategory === 'clarity'}
          count={suggestions.filter((s) => s.category === 'clarity').length}
          onClick={() => setSelectedCategory('clarity')}
        />
        <CategoryButton
          label="Completeness"
          active={selectedCategory === 'completeness'}
          count={suggestions.filter((s) => s.category === 'completeness').length}
          onClick={() => setSelectedCategory('completeness')}
        />
        <CategoryButton
          label="Handling"
          active={selectedCategory === 'handling'}
          count={suggestions.filter((s) => s.category === 'handling').length}
          onClick={() => setSelectedCategory('handling')}
        />
        <CategoryButton
          label="Other"
          active={selectedCategory === 'other'}
          count={suggestions.filter((s) => s.category === 'other').length}
          onClick={() => setSelectedCategory('other')}
        />
      </div>

      {/* Suggestions List */}
      <div className="space-y-3">
        {filteredSuggestions.map((suggestion, idx) => (
          <div
            key={idx}
            className={`border rounded-lg p-4 transition ${
              suggestion.priority === 'high'
                ? 'border-red-500/30 bg-red-500/5'
                : suggestion.priority === 'medium'
                ? 'border-yellow-500/30 bg-yellow-500/5'
                : 'border-gray-700 bg-gray-700/20'
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Priority Badge */}
              <div className="flex-shrink-0">
                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    suggestion.priority === 'high'
                      ? 'bg-red-500/20 text-red-400'
                      : suggestion.priority === 'medium'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-gray-600 text-gray-300'
                  }`}
                >
                  {suggestion.priority.toUpperCase()}
                </div>
              </div>

              {/* Suggestion Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                    {suggestion.category}
                  </span>
                  <span className="text-xs text-gray-500">
                    {suggestion.occurrences} occurrence{suggestion.occurrences !== 1 ? 's' : ''}
                  </span>
                </div>

                <p className="text-white font-medium mb-3">{suggestion.suggestion}</p>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => copySuggestion(suggestion.suggestion, idx)}
                    className={`text-xs px-3 py-1.5 rounded font-medium transition ${
                      copiedIndex === idx
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    {copiedIndex === idx ? '✓ Copied!' : 'Copy to Clipboard'}
                  </button>
                  <button
                    className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded font-medium transition text-white"
                    onClick={() => {
                      // In production, this would open the prompt editor with this suggestion
                      alert(
                        'This would open the prompt editor with this suggestion pre-filled. Coming soon!'
                      )
                    }}
                  >
                    Apply to Prompt
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-6 border-t border-gray-700">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-400 mb-2">💡 Quick Tip</h3>
          <p className="text-sm text-gray-300">
            Implement high-priority suggestions first. Test changes in a staging assistant before
            deploying to production. Review evaluation scores after each change to measure impact.
          </p>
        </div>
      </div>
    </div>
  )
}

interface CategoryButtonProps {
  label: string
  active: boolean
  count: number
  onClick: () => void
}

function CategoryButton({ label, active, count, onClick }: CategoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {label} {count > 0 && <span className="text-xs opacity-75">({count})</span>}
    </button>
  )
}
