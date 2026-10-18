'use client'

// voiceai:ab-test-ui-001 — A/B testing dashboard

import { useEffect, useState } from 'react'
import { FlaskConical, Plus, RefreshCw, TrendingUp } from 'lucide-react'

interface AbTest {
  id: string
  assistant_id: string
  test_type: string
  name: string | null
  status: 'active' | 'paused' | 'ended'
  variant_a: string
  variant_b: string
  variant_a_count: number
  variant_b_count: number
  variant_a_conversions: number
  variant_b_conversions: number
  created_at: string
}

function conversionRate(conversions: number, total: number): string {
  if (!total) return '0%'
  return ((conversions / total) * 100).toFixed(1) + '%'
}

export default function AbTestsPage() {
  const [tests, setTests] = useState<AbTest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    assistant_id: '',
    test_type: 'greeting',
    name: '',
    variant_a: '',
    variant_b: '',
  })
  const [creating, setCreating] = useState(false)

  async function fetchTests() {
    try {
      setLoading(true)
      const res = await fetch('/api/ab-tests')
      if (!res.ok) throw new Error('Failed to fetch A/B tests')
      const data = await res.json()
      setTests(data.tests || [])
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTests()
  }, [])

  async function handleCreate() {
    if (!form.assistant_id || !form.variant_a || !form.variant_b) {
      setError('Assistant ID, Variant A, and Variant B are required')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/ab-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to create test')
      }
      setShowCreate(false)
      setForm({ assistant_id: '', test_type: 'greeting', name: '', variant_a: '', variant_b: '' })
      await fetchTests()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const statusColor = (status: string) =>
    status === 'active' ? 'bg-green-100 text-green-700' :
    status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
    'bg-muted text-muted-foreground'

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-6 h-6 text-purple-500" />
          <h1 className="text-2xl font-bold">A/B Tests</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTests} className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted transition">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <Plus className="w-4 h-4" />
            New Experiment
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {showCreate && (
        <div className="rounded-lg border bg-card p-5 mb-6 space-y-4">
          <h2 className="font-semibold">Create Experiment</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Assistant ID *</label>
              <input
                value={form.assistant_id}
                onChange={e => setForm(f => ({ ...f, assistant_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="vapi_assistant_id"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Type</label>
              <select
                value={form.test_type}
                onChange={e => setForm(f => ({ ...f, test_type: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="greeting">Greeting</option>
                <option value="script">Script</option>
                <option value="persona">Persona</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Name (optional)</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="My experiment"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Variant A (control) *</label>
              <textarea
                value={form.variant_a}
                onChange={e => setForm(f => ({ ...f, variant_a: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
                placeholder="Hello! How can I help you today?"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Variant B (challenger) *</label>
              <textarea
                value={form.variant_b}
                onChange={e => setForm(f => ({ ...f, variant_b: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
                placeholder="Hi there! Thanks for calling. What can I do for you?"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 transition"
            >
              {creating ? 'Creating…' : 'Create Experiment'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : tests.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <FlaskConical className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No experiments yet. Create one to start testing.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map(test => (
            <div key={test.id} className="rounded-lg border bg-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold">{test.name || `${test.test_type} test`}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Assistant: {test.assistant_id} · Created {new Date(test.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(test.status)}`}>
                  {test.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Variant A', prompt: test.variant_a, calls: test.variant_a_count, conversions: test.variant_a_conversions },
                  { label: 'Variant B', prompt: test.variant_b, calls: test.variant_b_count, conversions: test.variant_b_conversions },
                ].map(v => (
                  <div key={v.label} className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide">{v.label}</span>
                      <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                        <TrendingUp className="w-3 h-3" />
                        {conversionRate(v.conversions, v.calls)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{v.prompt}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.calls} calls · {v.conversions} conversions
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
