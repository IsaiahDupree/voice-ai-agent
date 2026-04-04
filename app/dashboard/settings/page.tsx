// F0727: Settings tab shows account config
// F0728: Show masked API key status for all services
// F0729: Show and copy webhook URLs

'use client'

import { useEffect, useState } from 'react'

interface ServiceStatus {
  name: string
  hasKey: boolean
  keyPreview?: string
  status: 'configured' | 'missing' | 'unknown'
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
