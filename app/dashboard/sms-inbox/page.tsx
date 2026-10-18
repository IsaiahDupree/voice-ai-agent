'use client'

// voiceai:sms-twoway-001 — SMS inbox showing inbound messages with unread count badge

import { useEffect, useState } from 'react'
import { MessageSquare, RefreshCw, Phone } from 'lucide-react'

interface SmsThread {
  id: string
  contact_id: string
  from_number: string
  status: string
  last_message_at: string
  contacts: {
    name: string
    phone_number: string
  }
  sms_messages: { count: number }[]
  unread_count?: number
}

export default function SmsInboxPage() {
  const [threads, setThreads] = useState<SmsThread[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unreadTotal, setUnreadTotal] = useState(0)

  async function fetchThreads() {
    try {
      setLoading(true)
      const res = await fetch('/api/sms/threads?pageSize=50')
      if (!res.ok) throw new Error('Failed to fetch SMS threads')
      const data = await res.json()
      const items: SmsThread[] = data.data || data.threads || []
      setThreads(items)
      // Count threads with unread messages (status = 'active' or 'unread')
      const unread = items.filter(t => t.status === 'unread' || t.status === 'active').length
      setUnreadTotal(unread)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchThreads()
  }, [])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">SMS Inbox</h1>
          {unreadTotal > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white min-w-[1.5rem]">
              {unreadTotal}
            </span>
          )}
        </div>
        <button
          onClick={fetchThreads}
          className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No SMS conversations yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Inbound messages from contacts will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          {threads.map(thread => (
            <div key={thread.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">
                    {thread.contacts?.name || thread.from_number}
                  </p>
                  {(thread.status === 'unread' || thread.status === 'active') && (
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {thread.contacts?.phone_number || thread.from_number}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground">
                  {thread.last_message_at
                    ? new Date(thread.last_message_at).toLocaleString()
                    : '—'}
                </p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                  thread.status === 'unread'
                    ? 'bg-blue-100 text-blue-700'
                    : thread.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {thread.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
