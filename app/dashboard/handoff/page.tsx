// F0666: Handoff config UI
// Dashboard UI to configure handoff triggers and destination

'use client'

import { useEffect, useState } from 'react'
import type { HandoffConfig } from '@/app/api/handoff/config/route'

export default function HandoffConfigPage() {
  const [config, setConfig] = useState<HandoffConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [assistantId, setAssistantId] = useState('default')

  useEffect(() => {
    loadConfig()
  }, [assistantId])

  async function loadConfig() {
    try {
      const res = await fetch(`/api/handoff/config?assistant_id=${assistantId}`)
      const data = await res.json()
      setConfig(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading handoff config:', error)
      setLoading(false)
    }
  }

  async function saveConfig() {
    if (!config) return

    setSaving(true)
    try {
      const res = await fetch('/api/handoff/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      const result = await res.json()

      if (result.success) {
        alert('Handoff configuration saved successfully!')
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error saving config:', error)
      alert('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  function updateConfig(updates: Partial<HandoffConfig>) {
    setConfig((prev) => (prev ? { ...prev, ...updates } : null))
  }

  function updateTrigger(trigger: keyof HandoffConfig['triggers_enabled'], enabled: boolean) {
    if (!config) return
    setConfig({
      ...config,
      triggers_enabled: {
        ...config.triggers_enabled,
        [trigger]: enabled,
      },
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading configuration...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-gray-600">Failed to load configuration</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Human Handoff Configuration</h1>
          <a
            href="/dashboard"
            className="px-4 py-2 bg-white rounded-lg shadow hover:bg-gray-50 transition text-sm font-medium"
          >
            ← Back to Dashboard
          </a>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Assistant ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assistant ID
            </label>
            <input
              type="text"
              value={assistantId}
              onChange={(e) => setAssistantId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="default"
            />
          </div>

          {/* Transfer Destination */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transfer Destination Phone Number
            </label>
            <input
              type="tel"
              value={config.transfer_destination}
              onChange={(e) => updateConfig({ transfer_destination: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="+1234567890"
            />
            <p className="text-xs text-gray-500 mt-1">
              Phone number where calls should be transferred
            </p>
          </div>

          {/* F0645: Hold Music */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hold Music URL (optional)
            </label>
            <input
              type="url"
              value={config.hold_music_url || ''}
              onChange={(e) => updateConfig({ hold_music_url: e.target.value || null })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/hold-music.mp3"
            />
            <p className="text-xs text-gray-500 mt-1">
              Audio file to play during warm transfer setup
            </p>
          </div>

          {/* Handoff Triggers */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Handoff Triggers</h3>
            <div className="space-y-2">
              {Object.entries({
                high_value: 'High-Value Signal (enterprise keywords, large budget)',
                frustration: 'Frustration Detection (angry, upset caller)',
                compliance: 'Compliance/Legal Topics (lawsuit, GDPR, etc.)',
                explicit_request: 'Explicit Request (caller asks for human)',
                dtmf_zero: 'DTMF 0 Press (caller presses 0)', // F0679
              }).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={
                      config.triggers_enabled[key as keyof HandoffConfig['triggers_enabled']]
                    }
                    onChange={(e) =>
                      updateTrigger(
                        key as keyof HandoffConfig['triggers_enabled'],
                        e.target.checked
                      )
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* F0672, F0681: Fallback Behavior */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Fallback Behavior (Rep Offline)
            </h3>
            <select
              value={config.fallback_behavior}
              onChange={(e) =>
                updateConfig({
                  fallback_behavior: e.target.value as 'callback' | 'voicemail' | 'sms',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="callback">Schedule Callback</option>
              <option value="sms">Send SMS with Contact Info</option>
              <option value="voicemail">Send to Voicemail</option>
            </select>

            {config.fallback_behavior === 'sms' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fallback SMS Message Template
                </label>
                <textarea
                  value={config.fallback_sms_template || ''}
                  onChange={(e) => updateConfig({ fallback_sms_template: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Thank you for calling. Our representative is currently unavailable..."
                />
              </div>
            )}
          </div>

          {/* F0682: Recording Notice */}
          <div>
            <label className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                checked={config.recording_notice_enabled}
                onChange={(e) => updateConfig({ recording_notice_enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Play Recording Notice Before Transfer
              </span>
            </label>

            {config.recording_notice_enabled && (
              <textarea
                value={config.recording_notice_message || ''}
                onChange={(e) => updateConfig({ recording_notice_message: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="This call is being recorded for quality and training purposes."
              />
            )}
          </div>

          {/* F0675: Resume on Decline */}
          <div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.resume_on_decline}
                onChange={(e) => updateConfig({ resume_on_decline: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Agent Resumes Call if Rep Declines Transfer
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-7">
              If enabled, AI agent will continue the call when transfer is declined
            </p>
          </div>

          {/* F0676: Log Transfer Reason */}
          <div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.log_transfer_reason}
                onChange={(e) => updateConfig({ log_transfer_reason: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Record Transfer Reason in Transcript
              </span>
            </label>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
