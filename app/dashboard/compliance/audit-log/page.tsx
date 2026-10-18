'use client'

import { useState, useEffect, useCallback } from 'react'

type AuditAction =
  | 'CREATE' | 'UPDATE' | 'DELETE' | 'START' | 'STOP'
  | 'PAUSE' | 'RESUME' | 'TRANSFER' | 'CONFIGURE' | 'LOGIN' | 'LOGOUT'

interface AuditEntry {
  id: string
  action: AuditAction
  resource: string
  resource_id: string
  user_id: string
  user_name?: string
  ip_address?: string
  changes?: Record<string, any>
  error?: string
  created_at: string
}

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  START: 'bg-emerald-100 text-emerald-800',
  STOP: 'bg-orange-100 text-orange-800',
  PAUSE: 'bg-yellow-100 text-yellow-800',
  RESUME: 'bg-teal-100 text-teal-800',
  TRANSFER: 'bg-purple-100 text-purple-800',
  CONFIGURE: 'bg-indigo-100 text-indigo-800',
  LOGIN: 'bg-sky-100 text-sky-800',
  LOGOUT: 'bg-gray-100 text-gray-800',
}

const RESOURCE_TYPES = [
  '', 'campaign', 'contact', 'persona', 'call', 'booking',
  'tenant', 'api_key', 'user', 'flow', 'knowledge_base',
]
const ACTIONS: Array<'' | AuditAction> = [
  '', 'CREATE', 'UPDATE', 'DELETE', 'START', 'STOP',
  'PAUSE', 'RESUME', 'TRANSFER', 'CONFIGURE', 'LOGIN', 'LOGOUT',
]

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [resource, setResource] = useState('')
  const [action, setAction] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [offset, setOffset] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const PAGE_SIZE = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (resource) params.set('resource', resource)
    if (action) params.set('action', action)
    if (startDate) params.set('startDate', new Date(startDate).toISOString())
    if (endDate) params.set('endDate', new Date(endDate + 'T23:59:59').toISOString())
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(offset))

    try {
      const res = await fetch(`/api/audit-log?${params}`)
      const data = await res.json()
      setEntries(data.logs || [])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [resource, action, startDate, endDate, offset])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function handleFilter() {
    setOffset(0)
    fetchLogs()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Immutable record of all administrative actions. Entries cannot be modified or deleted.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resource</label>
          <select
            value={resource}
            onChange={e => setResource(e.target.value)}
            className="border border-border rounded px-3 py-1.5 text-sm bg-background"
          >
            {RESOURCE_TYPES.map(r => (
              <option key={r} value={r}>{r || 'All resources'}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Action</label>
          <select
            value={action}
            onChange={e => setAction(e.target.value)}
            className="border border-border rounded px-3 py-1.5 text-sm bg-background"
          >
            {ACTIONS.map(a => (
              <option key={a} value={a}>{a || 'All actions'}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">From</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="border border-border rounded px-3 py-1.5 text-sm bg-background"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="border border-border rounded px-3 py-1.5 text-sm bg-background"
          />
        </div>
        <button
          onClick={handleFilter}
          className="px-4 py-1.5 bg-primary text-primary-foreground rounded text-sm font-medium hover:opacity-90"
        >
          Apply
        </button>
        <button
          onClick={() => { setResource(''); setAction(''); setStartDate(''); setEndDate(''); setOffset(0) }}
          className="px-4 py-1.5 border border-border rounded text-sm hover:bg-muted"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading audit entries…</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No audit entries found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Time</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Resource</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Resource ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">IP</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map(entry => (
                <>
                  <tr
                    key={entry.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[entry.action] || 'bg-gray-100 text-gray-700'}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium capitalize">{entry.resource}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                      {entry.resource_id}
                    </td>
                    <td className="px-4 py-3">{entry.user_name || entry.user_id}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{entry.ip_address || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(entry.changes || entry.error) ? (
                        <span className="text-xs underline cursor-pointer">
                          {expandedId === entry.id ? 'hide' : 'show'}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                  {expandedId === entry.id && (entry.changes || entry.error) && (
                    <tr key={`${entry.id}-detail`} className="bg-muted/20">
                      <td colSpan={7} className="px-6 py-3">
                        {entry.error && (
                          <div className="text-red-600 text-xs mb-2">Error: {entry.error}</div>
                        )}
                        {entry.changes && (
                          <pre className="text-xs font-mono bg-background border border-border rounded p-3 overflow-auto max-h-40">
                            {JSON.stringify(entry.changes, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>Showing {offset + 1}–{offset + entries.length} entries</span>
        <div className="flex gap-2">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="px-3 py-1 border border-border rounded disabled:opacity-40 hover:bg-muted"
          >
            Previous
          </button>
          <button
            disabled={entries.length < PAGE_SIZE}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="px-3 py-1 border border-border rounded disabled:opacity-40 hover:bg-muted"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
