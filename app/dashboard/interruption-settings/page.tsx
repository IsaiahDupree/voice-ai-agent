'use client';

/**
 * Interruption Settings Dashboard
 * Configure semantic VAD interruption sensitivity per assistant
 */

import { useState, useEffect } from 'react';

interface InterruptionConfig {
  assistantId: string;
  sensitivity: 'low' | 'medium' | 'high';
  enabled: boolean;
  confidenceThreshold: number;
  notes: string | null;
  isDefault: boolean;
}

interface InterruptionStats {
  total: number;
  pauseTriggered: number;
  pauseRate: number;
  avgConfidence: string;
  byType: Record<string, number>;
  falsePositives: number;
  falseNegatives: number;
  falsePositiveRate: number;
}

export default function InterruptionSettingsPage() {
  const [assistantId, setAssistantId] = useState('asst_default');
  const [config, setConfig] = useState<InterruptionConfig | null>(null);
  const [stats, setStats] = useState<InterruptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch config and stats
  useEffect(() => {
    fetchConfig();
    fetchStats();
  }, [assistantId]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/assistants/${assistantId}/interruption-config`);
      const data = await res.json();
      setConfig(data);
    } catch (error) {
      console.error('Error fetching config:', error);
      setMessage('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(
        `/api/analytics/interruption-patterns?assistantId=${assistantId}&timeRange=7d`
      );
      const data = await res.json();
      setStats(data.summary);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setMessage('');

      const res = await fetch(`/api/assistants/${assistantId}/interruption-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensitivity: config.sensitivity,
          enabled: config.enabled,
          confidenceThreshold: config.confidenceThreshold,
          notes: config.notes,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage('✅ Settings saved successfully');
        setConfig(data.config);
        // Refresh stats after save
        setTimeout(fetchStats, 500);
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Failed to save settings');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset to default settings?')) return;

    try {
      const res = await fetch(`/api/assistants/${assistantId}/interruption-config`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMessage('✅ Reset to defaults');
        fetchConfig();
      } else {
        setMessage('❌ Failed to reset');
      }
    } catch (error) {
      setMessage('❌ Reset failed');
      console.error('Reset error:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!config) {
    return <div className="p-8">Configuration not found</div>;
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Interruption Detection Settings</h1>

      {/* Assistant Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Assistant ID
        </label>
        <input
          type="text"
          value={assistantId}
          onChange={(e) => setAssistantId(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="e.g., asst_abc123"
        />
      </div>

      {/* Message */}
      {message && (
        <div className="mb-4 p-3 bg-gray-100 rounded-md text-sm">
          {message}
        </div>
      )}

      {/* Stats Summary */}
      {stats && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold mb-3">Last 7 Days Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Total Classifications</div>
              <div className="text-xl font-bold">{stats.total}</div>
            </div>
            <div>
              <div className="text-gray-600">Pause Rate</div>
              <div className="text-xl font-bold">{stats.pauseRate.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-gray-600">False Positives</div>
              <div className="text-xl font-bold">{stats.falsePositives}</div>
            </div>
            <div>
              <div className="text-gray-600">Avg Confidence</div>
              <div className="text-xl font-bold">{stats.avgConfidence}</div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <div className="space-y-6 bg-white p-6 rounded-lg border">
        {/* Enabled Toggle */}
        <div>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="w-5 h-5"
            />
            <span className="font-medium">Enable Semantic Interruption Detection</span>
          </label>
          <p className="text-sm text-gray-600 mt-1">
            Classify utterances to reduce false interruptions from fillers and affirmations
          </p>
        </div>

        {/* Sensitivity */}
        <div>
          <label className="block font-medium mb-2">
            Sensitivity Level
          </label>
          <div className="space-y-2">
            {(['low', 'medium', 'high'] as const).map((level) => (
              <label key={level} className="flex items-center space-x-3">
                <input
                  type="radio"
                  name="sensitivity"
                  value={level}
                  checked={config.sensitivity === level}
                  onChange={(e) =>
                    setConfig({ ...config, sensitivity: e.target.value as any })
                  }
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium capitalize">{level}</div>
                  <div className="text-sm text-gray-600">
                    {level === 'low' &&
                      'Strict: Only very clear interruptions pause the agent'}
                    {level === 'medium' &&
                      'Balanced: Standard interruption detection (recommended)'}
                    {level === 'high' &&
                      'Responsive: More sensitive, may have false positives'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Confidence Threshold */}
        <div>
          <label className="block font-medium mb-2">
            Confidence Threshold: {config.confidenceThreshold.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.5"
            max="0.95"
            step="0.05"
            value={config.confidenceThreshold}
            onChange={(e) =>
              setConfig({ ...config, confidenceThreshold: parseFloat(e.target.value) })
            }
            className="w-full"
          />
          <p className="text-sm text-gray-600 mt-1">
            Minimum confidence required to trigger pause. Lower = more responsive, higher = more
            strict.
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block font-medium mb-2">Notes</label>
          <textarea
            value={config.notes || ''}
            onChange={(e) => setConfig({ ...config, notes: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            rows={3}
            placeholder="Optional notes about this configuration..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Reset to Defaults
          </button>
        </div>

        {config.isDefault && (
          <p className="text-sm text-gray-500">Currently using default settings</p>
        )}
      </div>

      {/* Classification Type Breakdown */}
      {stats && (
        <div className="mt-6 bg-white p-6 rounded-lg border">
          <h3 className="font-semibold mb-4">Classification Breakdown</h3>
          <div className="space-y-2">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="flex justify-between items-center">
                <span className="capitalize">{type.replace('-', ' ')}</span>
                <div className="flex items-center gap-4">
                  <span className="text-gray-600">
                    {stats.total > 0
                      ? ((count / stats.total) * 100).toFixed(1)
                      : '0.0'}%
                  </span>
                  <span className="font-semibold">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
