// F0695: Call detail drawer
// F0696: Call detail transcript
// F0697: Call detail contact
// F0698: Transfer button
// F0699: End call button

'use client'

import { useEffect, useState } from 'react'

interface CallDetailDrawerProps {
  callId: string
  isOpen: boolean
  onClose: () => void
}

interface CallDetail {
  id: number
  call_id: string
  status: string
  direction: string
  phone_number: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  outcome: string | null
  sentiment: string | null
  agent_name: string | null
  transfer_status: string | null
  recording_url: string | null // F0749: Recording URL
  contact?: {
    id: number
    name: string
    email: string | null
    notes: string | null
  }
}

interface TranscriptMessage {
  role: 'agent' | 'user' | 'system'
  content: string
  timestamp: string
}

export default function CallDetailDrawer({ callId, isOpen, onClose }: CallDetailDrawerProps) {
  const [call, setCall] = useState<CallDetail | null>(null)
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'details' | 'transcript' | 'contact'>('details')

  useEffect(() => {
    if (isOpen && callId) {
      loadCallDetail()
      loadTranscript()
    }
  }, [isOpen, callId])

  async function loadCallDetail() {
    try {
      const res = await fetch(`/api/calls/${callId}`)
      const data = await res.json()
      setCall(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading call detail:', error)
      setLoading(false)
    }
  }

  async function loadTranscript() {
    try {
      const res = await fetch(`/api/transcripts/${callId}`)
      const data = await res.json()
      setTranscript(data.messages || [])
    } catch (error) {
      console.error('Error loading transcript:', error)
    }
  }

  // F0698: Transfer call
  async function handleTransfer() {
    if (!confirm('Transfer this call to a human representative?')) return

    try {
      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId }),
      })

      const result = await res.json()

      if (result.success) {
        alert('Call transfer initiated')
        loadCallDetail()
      } else {
        alert(`Transfer failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Transfer error:', error)
      alert('Failed to transfer call')
    }
  }

  // F0699: End call
  async function handleEndCall() {
    if (!confirm('End this call?')) return

    try {
      const res = await fetch(`/api/calls/${callId}`, {
        method: 'DELETE',
      })

      const result = await res.json()

      if (result.success) {
        alert('Call ended')
        onClose()
      } else {
        alert(`Failed to end call: ${result.error}`)
      }
    } catch (error) {
      console.error('End call error:', error)
      alert('Failed to end call')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>

      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-xl">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Call Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : call ? (
            <>
              {/* Tabs */}
              <div className="border-b">
                <nav className="flex space-x-4 px-6">
                  {['details', 'transcript', 'contact'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`py-3 px-1 border-b-2 font-medium text-sm capitalize ${
                        activeTab === tab
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'details' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">
                        Call ID
                      </label>
                      <div className="text-sm font-mono text-gray-900 mt-1">{call.call_id}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">
                          Status
                        </label>
                        <div className="mt-1">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              call.status === 'in-progress'
                                ? 'bg-green-100 text-green-800'
                                : call.status === 'ended'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {call.transfer_status || call.status}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">
                          Direction
                        </label>
                        <div className="text-sm text-gray-900 mt-1 capitalize">
                          {call.direction}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">
                          Phone Number
                        </label>
                        <div className="text-sm text-gray-900 mt-1">{call.phone_number}</div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">
                          Duration
                        </label>
                        <div className="text-sm text-gray-900 mt-1">
                          {call.duration_seconds
                            ? `${Math.floor(call.duration_seconds / 60)}:${(
                                call.duration_seconds % 60
                              )
                                .toString()
                                .padStart(2, '0')}`
                            : 'Ongoing'}
                        </div>
                      </div>

                      {call.sentiment && (
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">
                            Sentiment
                          </label>
                          <div className="mt-1">
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                call.sentiment === 'positive'
                                  ? 'bg-green-100 text-green-800'
                                  : call.sentiment === 'neutral'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {call.sentiment}
                            </span>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">
                          Agent
                        </label>
                        <div className="text-sm text-gray-900 mt-1">
                          {call.agent_name || 'AI Agent'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">
                        Started At
                      </label>
                      <div className="text-sm text-gray-900 mt-1">
                        {new Date(call.started_at).toLocaleString()}
                      </div>
                    </div>

                    {call.ended_at && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">
                          Ended At
                        </label>
                        <div className="text-sm text-gray-900 mt-1">
                          {new Date(call.ended_at).toLocaleString()}
                        </div>
                      </div>
                    )}

                    {call.outcome && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">
                          Outcome
                        </label>
                        <div className="text-sm text-gray-900 mt-1 capitalize">{call.outcome}</div>
                      </div>
                    )}

                    {/* F0749: Call recording player */}
                    {call.recording_url && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">
                          Call Recording
                        </label>
                        <div className="mt-2">
                          <audio controls className="w-full">
                            <source src={call.recording_url} type="audio/mpeg" />
                            <source src={call.recording_url} type="audio/wav" />
                            Your browser does not support the audio element.
                          </audio>
                          <a
                            href={call.recording_url}
                            download
                            className="mt-2 inline-flex items-center text-xs text-blue-600 hover:underline"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download Recording
                          </a>
                        </div>
                      </div>
                    )}

                    {/* F0698, F0699: Action buttons */}
                    {call.status === 'in-progress' && (
                      <div className="pt-4 border-t space-y-3">
                        <button
                          onClick={handleTransfer}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          Transfer to Human
                        </button>
                        <button
                          onClick={handleEndCall}
                          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                        >
                          End Call
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* F0696: Transcript tab */}
                {activeTab === 'transcript' && (
                  <div className="space-y-3">
                    {transcript.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        No transcript available yet
                      </p>
                    ) : (
                      transcript.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg ${
                            msg.role === 'agent'
                              ? 'bg-blue-50 border-l-4 border-blue-500'
                              : msg.role === 'user'
                              ? 'bg-gray-50 border-l-4 border-gray-500'
                              : 'bg-yellow-50 border-l-4 border-yellow-500'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-semibold text-gray-700 uppercase">
                              {msg.role}
                            </span>
                            <span className="text-xs text-gray-500">{msg.timestamp}</span>
                          </div>
                          <div className="text-sm text-gray-900">{msg.content}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* F0697: Contact tab */}
                {activeTab === 'contact' && (
                  <div className="space-y-4">
                    {call.contact ? (
                      <>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">
                            Name
                          </label>
                          <div className="text-sm text-gray-900 mt-1">{call.contact.name}</div>
                        </div>

                        {call.contact.email && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase">
                              Email
                            </label>
                            <div className="text-sm text-gray-900 mt-1">{call.contact.email}</div>
                          </div>
                        )}

                        {call.contact.notes && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase">
                              Notes
                            </label>
                            <div className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">
                              {call.contact.notes}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-500 text-center py-8">
                        No contact information available
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500">Call not found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
