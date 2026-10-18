'use client'

// voiceai:dnc-ui-001 — DNC list management UI

import { useEffect, useState } from 'react'
import { ShieldOff, Plus, Trash2, RefreshCw } from 'lucide-react'

interface DncEntry {
  id: string
  phone: string
  source: string
  reason: string | null
  added_at: string
  added_by: string | null
}

export default function DncPage() {
  const [entries, setEntries] = useState<DncEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addPhone, setAddPhone] = useState('')
  const [addReason, setAddReason] = useState('')
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function fetchEntries() {
    try {
      setLoading(true)
      const res = await fetch('/api/dnc')
      if (!res.ok) throw new Error('Failed to fetch DNC list')
      const data = await res.json()
      setEntries(data.dnc || [])
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntries()
  }, [])

  async function handleAdd() {
    if (!addPhone.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/dnc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: addPhone.trim(), reason: addReason.trim() || null, source: 'manual' }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to add number')
      }
      setAddPhone('')
      setAddReason('')
      setShowAddForm(false)
      await fetchEntries()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(phone: string) {
    try {
      const res = await fetch(`/api/dnc?phone=${encodeURIComponent(phone)}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to remove number')
      }
      setConfirmDelete(null)
      await fetchEntries()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldOff className="w-6 h-6 text-red-500" />
          <h1 className="text-2xl font-bold">DNC List</h1>
          <span className="text-sm text-muted-foreground">({entries.length} entries)</span>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchEntries} className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted transition">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Number
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {showAddForm && (
        <div className="rounded-lg border bg-card p-4 mb-4">
          <h2 className="font-semibold mb-3">Add to DNC List</h2>
          <div className="flex gap-3">
            <input
              type="tel"
              value={addPhone}
              onChange={e => setAddPhone(e.target.value)}
              placeholder="+15551234567"
              className="flex-1 px-3 py-2 border rounded-lg text-sm"
            />
            <input
              type="text"
              value={addReason}
              onChange={e => setAddReason(e.target.value)}
              placeholder="Reason (optional)"
              className="flex-1 px-3 py-2 border rounded-lg text-sm"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !addPhone.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {adding ? 'Adding…' : 'Add'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <ShieldOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No numbers on the DNC list.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-mono font-medium">{entry.phone}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {entry.reason || 'No reason'} · Added {new Date(entry.added_at).toLocaleDateString()} · Source: {entry.source}
                </p>
              </div>
              {confirmDelete === entry.phone ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Confirm?</span>
                  <button onClick={() => handleDelete(entry.phone)} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">Yes</button>
                  <button onClick={() => setConfirmDelete(null)} className="px-3 py-1 text-sm border rounded hover:bg-muted">No</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(entry.phone)}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50 transition"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
