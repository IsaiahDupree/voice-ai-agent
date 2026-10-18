// F0727: Settings tab shows account config
// F0728: Show masked API key status for all services
// F0729: Show and copy webhook URLs

'use client'

import { useEffect, useState, useRef } from 'react'

interface ServiceStatus {
  name: string
  hasKey: boolean
  keyPreview?: string
  status: 'configured' | 'missing' | 'unknown'
}

function EmailReportsSection() {
  const [daily, setDaily] = useState(false)
  const [weekly, setWeekly] = useState(false)
  const [recipients, setRecipients] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [testRecipient, setTestRecipient] = useState('')
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function addRecipient() {
    const email = newEmail.trim()
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !recipients.includes(email)) {
      setRecipients(prev => [...prev, email])
      setNewEmail('')
      inputRef.current?.focus()
    }
  }

  function removeRecipient(email: string) {
    setRecipients(prev => prev.filter(r => r !== email))
  }

  async function sendTestEmail() {
    const to = testRecipient.trim() || recipients[0]
    if (!to) return
    setTesting(true)
    setTestMsg(null)
    try {
      const res = await fetch('/api/reports/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: to }),
      })
      const data = await res.json()
      if (res.ok) {
        setTestMsg({ ok: true, text: `Test report sent to ${data.recipient}` })
      } else {
        setTestMsg({ ok: false, text: data.error || 'Failed to send test email' })
      }
    } catch {
      setTestMsg({ ok: false, text: 'Network error sending test email' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Email Reports</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure automated daily and weekly analytics report emails. Requires{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">RESEND_API_KEY</code> to be set.
        </p>
      </div>

      {/* Schedules */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Schedule</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={daily}
            onChange={e => setDaily(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <div>
            <div className="text-sm font-medium">Daily report</div>
            <div className="text-xs text-gray-500">Sent every morning at 8 AM via <code className="bg-gray-100 px-0.5 rounded">POST /api/reports/daily</code></div>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={weekly}
            onChange={e => setWeekly(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <div>
            <div className="text-sm font-medium">Weekly report</div>
            <div className="text-xs text-gray-500">Sent every Monday at 9 AM via <code className="bg-gray-100 px-0.5 rounded">POST /api/reports/weekly</code></div>
          </div>
        </label>
        <p className="text-xs text-gray-400">
          Note: Schedules are executed by Vercel Cron or an external scheduler. These toggles serve as documentation references for your <code>vercel.json</code> cron config.
        </p>
      </div>

      {/* Recipients */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recipients</h3>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRecipient()}
            placeholder="admin@example.com"
            className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={addRecipient}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
          >
            Add
          </button>
        </div>
        {recipients.length > 0 ? (
          <ul className="space-y-2">
            {recipients.map(email => (
              <li key={email} className="flex items-center justify-between p-2 border border-gray-100 rounded bg-gray-50 text-sm">
                <span>{email}</span>
                <button
                  onClick={() => removeRecipient(email)}
                  className="text-red-500 hover:text-red-700 text-xs ml-4"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-400">No recipients added. Falls back to <code className="bg-gray-100 px-0.5 rounded">ADMIN_EMAIL</code> env var.</p>
        )}
      </div>

      {/* Test send */}
      <div className="space-y-3 pt-1 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Send Test Report</h3>
        <div className="flex gap-2">
          <input
            type="email"
            value={testRecipient}
            onChange={e => setTestRecipient(e.target.value)}
            placeholder={recipients[0] || 'you@example.com'}
            className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={sendTestEmail}
            disabled={testing || (!testRecipient.trim() && recipients.length === 0)}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 transition"
          >
            {testing ? 'Sending…' : 'Send Test'}
          </button>
        </div>
        {testMsg && (
          <p className={`text-sm px-3 py-2 rounded ${testMsg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {testMsg.text}
          </p>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [webhookBase, setWebhookBase] = useState('')
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      // F0728: Check API key status
      const res = await fetch('/api/settings/keys-status')
      if (res.ok) {
        const data = await res.json()
        setServices(data.services || [])
      }

      // F0729: Get webhook URLs
      setWebhookBase(window.location.origin)
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const webhookUrls = [
    {
      label: 'Call Status Webhook',
      url: `${webhookBase}/api/webhooks/vapi/call-status`,
      description: 'Receives call status updates from Vapi',
    },
    {
      label: 'Twilio SMS Webhook',
      url: `${webhookBase}/api/webhooks/twilio/sms`,
      description: 'Receives incoming SMS messages',
    },
    {
      label: 'Cal.com Booking Webhook',
      url: `${webhookBase}/api/webhooks/calcom/booking`,
      description: 'Receives booking confirmations',
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading settings...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <a
            href="/dashboard"
            className="px-4 py-2 bg-white rounded-lg shadow hover:bg-gray-50 transition"
          >
            ← Back to Dashboard
          </a>
        </div>

        {/* F0728: API Keys Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">API Keys Status</h2>
          <p className="text-sm text-gray-600 mb-4">
            Your API keys are stored securely in environment variables and never exposed to the
            client.
          </p>
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      service.status === 'configured'
                        ? 'bg-green-500'
                        : service.status === 'missing'
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                    }`}
                  />
                  <div>
                    <p className="font-medium text-gray-900">{service.name}</p>
                    {service.keyPreview && (
                      <p className="text-xs text-gray-500 font-mono">{service.keyPreview}</p>
                    )}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    service.status === 'configured'
                      ? 'bg-green-100 text-green-800'
                      : service.status === 'missing'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {service.status}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> To update API keys, edit your <code>.env.local</code> file and
              restart the dev server.
            </p>
          </div>
        </div>

        {/* F0729: Webhook URLs */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Webhook URLs</h2>
          <p className="text-sm text-gray-600 mb-4">
            Configure these webhook URLs in your external services to receive real-time updates.
          </p>
          <div className="space-y-4">
            {webhookUrls.map((webhook) => (
              <div key={webhook.label} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">{webhook.label}</h3>
                    <p className="text-sm text-gray-600 mt-1">{webhook.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-mono text-gray-700 overflow-x-auto">
                    {webhook.url}
                  </code>
                  <button
                    onClick={() => copyToClipboard(webhook.url, webhook.label)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition whitespace-nowrap"
                  >
                    {copied === webhook.label ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-900">
                <strong>Vapi Configuration:</strong>
              </p>
              <ol className="text-sm text-yellow-900 list-decimal list-inside mt-2 space-y-1">
                <li>Go to Vapi Dashboard → Settings → Webhooks</li>
                <li>Add the Call Status Webhook URL above</li>
                <li>Select events: call.started, call.ended, call.failed</li>
              </ol>
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-900">
                <strong>Twilio Configuration:</strong>
              </p>
              <ol className="text-sm text-yellow-900 list-decimal list-inside mt-2 space-y-1">
                <li>Go to Twilio Console → Phone Numbers</li>
                <li>Select your number</li>
                <li>Under "Messaging", set the webhook URL for incoming messages</li>
              </ol>
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-900">
                <strong>Cal.com Configuration:</strong>
              </p>
              <ol className="text-sm text-yellow-900 list-decimal list-inside mt-2 space-y-1">
                <li>Go to Cal.com Settings → Webhooks</li>
                <li>Add new webhook with the Booking Webhook URL above</li>
                <li>Select events: BOOKING_CREATED, BOOKING_CANCELLED</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Email Reports */}
        <EmailReportsSection />

        {/* Additional Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">System Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Environment</p>
              <p className="font-medium">
                {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">API Base URL</p>
              <p className="font-medium font-mono text-sm">{webhookBase}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Health Check</p>
              <a
                href="/api/health"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                /api/health →
              </a>
            </div>
            <div>
              <p className="text-sm text-gray-600">Database</p>
              <p className="font-medium">Supabase</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
