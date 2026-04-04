// F0711: Contact detail page

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Contact {
  id: number
  name: string
  phone: string
  email: string | null
  company: string | null
  deal_stage: string | null
  notes: any
  created_at: string
  updated_at: string
  metadata?: any
  sms_consent?: boolean
}

interface TimelineEvent {
  type: 'call' | 'sms' | 'booking' | 'note'
  timestamp: string
  id?: string
  data: any
}

interface TimelineData {
  contactId: number
  timeline: TimelineEvent[]
  stats: {
    totalCalls: number
    totalSMS: number
    totalBookings: number
    totalNotes: number
  }
}

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const contactId = params.id as string

  const [contact, setContact] = useState<Contact | null>(null)
  const [timeline, setTimeline] = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<Contact>>({})

  useEffect(() => {
    loadContactData()
  }, [contactId])

  async function loadContactData() {
    setLoading(true)
    try {
      const [contactRes, timelineRes] = await Promise.all([
        fetch(`/api/contacts/${contactId}`),
        fetch(`/api/contacts/${contactId}/timeline`),
      ])

      if (contactRes.ok) {
        const contactData = await contactRes.json()
        setContact(contactData)
        setFormData(contactData)
      }

      if (timelineRes.ok) {
        const timelineData = await timelineRes.json()
        setTimeline(timelineData)
      }
    } catch (error) {
      console.error('Error loading contact:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!contact) return

    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setContact(updated)
        setEditing(false)
      }
    } catch (error) {
      console.error('Error updating contact:', error)
      alert('Failed to update contact')
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.push('/dashboard/enhanced')
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
      alert('Failed to delete contact')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading contact...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-600">Contact not found</p>
            <button
              onClick={() => router.push('/dashboard/enhanced')}
              className="mt-4 text-blue-600 hover:underline"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/enhanced')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Contact Details</h1>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => {
                    setEditing(false)
                    setFormData(contact)
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Edit Contact
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {/* Contact Info Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
          {editing ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={formData.company || ''}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="text-lg font-medium">{contact.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="text-lg font-medium">{contact.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="text-lg font-medium">{contact.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Company</p>
                <p className="text-lg font-medium">{contact.company || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Deal Stage</p>
                {contact.deal_stage ? (
                  <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {contact.deal_stage}
                  </span>
                ) : (
                  <p className="text-gray-400">-</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600">SMS Consent</p>
                <p className="text-lg font-medium">
                  {contact.sms_consent ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        {timeline && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Total Calls</p>
              <p className="text-3xl font-bold text-blue-600">{timeline.stats.totalCalls}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Total SMS</p>
              <p className="text-3xl font-bold text-green-600">{timeline.stats.totalSMS}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Bookings</p>
              <p className="text-3xl font-bold text-purple-600">
                {timeline.stats.totalBookings}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Notes</p>
              <p className="text-3xl font-bold text-orange-600">{timeline.stats.totalNotes}</p>
            </div>
          </div>
        )}

        {/* Timeline */}
        {timeline && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Activity Timeline</h2>
            <div className="space-y-4">
              {timeline.timeline.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No activity yet</p>
              ) : (
                timeline.timeline.map((event, idx) => (
                  <div key={idx} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0">
                    <div className="flex-shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          event.type === 'call'
                            ? 'bg-blue-100 text-blue-600'
                            : event.type === 'sms'
                            ? 'bg-green-100 text-green-600'
                            : event.type === 'booking'
                            ? 'bg-purple-100 text-purple-600'
                            : 'bg-orange-100 text-orange-600'
                        }`}
                      >
                        {event.type === 'call' ? '📞' : event.type === 'sms' ? '💬' : event.type === 'booking' ? '📅' : '📝'}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium capitalize">{event.type}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-sm text-gray-600">
                        {event.type === 'call' && (
                          <>
                            <p>Direction: {event.data.direction}</p>
                            <p>Status: {event.data.status}</p>
                            {event.data.duration && <p>Duration: {event.data.duration}s</p>}
                            {event.data.cost && <p>Cost: ${event.data.cost.toFixed(4)}</p>}
                          </>
                        )}
                        {event.type === 'sms' && (
                          <>
                            <p>Direction: {event.data.direction}</p>
                            <p>Status: {event.data.status}</p>
                            <p className="mt-1 italic">"{event.data.body}"</p>
                          </>
                        )}
                        {event.type === 'booking' && (
                          <>
                            <p>Event: {event.data.event_type}</p>
                            <p>Start: {new Date(event.data.start_time).toLocaleString()}</p>
                            <p>Status: {event.data.status}</p>
                          </>
                        )}
                        {event.type === 'note' && (
                          <p className="italic">{event.data.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
