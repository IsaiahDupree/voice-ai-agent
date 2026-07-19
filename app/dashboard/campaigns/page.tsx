'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ChevronRight, X } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
  contacts_count: number;
  calls_made: number;
  bookings_made: number;
  conversion_rate: number;
  created_at: string;
}

interface CreateCampaignForm {
  name: string;
  assistantId: string;
  callingHoursStart: string;
  callingHoursEnd: string;
  callingHoursTimezone: string;
  maxCallsPerDay: string;
  voicemailMessage: string;
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateCampaignForm>({
    name: '',
    assistantId: '',
    callingHoursStart: '09:00',
    callingHoursEnd: '17:00',
    callingHoursTimezone: 'America/New_York',
    maxCallsPerDay: '',
    voicemailMessage: '',
  });

  useEffect(() => {
    fetchCampaigns();
  }, [page]);

  async function fetchCampaigns() {
    try {
      setLoading(true);
      const response = await fetch(`/api/campaigns?limit=50&offset=${(page - 1) * 50}`);
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const data = await response.json();
      setCampaigns(Array.isArray(data) ? data : data.campaigns || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          assistantId: form.assistantId.trim() || 'default',
          callingHoursStart: form.callingHoursStart,
          callingHoursEnd: form.callingHoursEnd,
          callingHoursTimezone: form.callingHoursTimezone,
          maxCallsPerDay: form.maxCallsPerDay ? parseInt(form.maxCallsPerDay) : undefined,
          voicemailMessage: form.voicemailMessage.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create campaign');
      setShowCreate(false);
      setForm({
        name: '',
        assistantId: '',
        callingHoursStart: '09:00',
        callingHoursEnd: '17:00',
        callingHoursTimezone: 'America/New_York',
        maxCallsPerDay: '',
        voicemailMessage: '',
      });
      await fetchCampaigns();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-blue-100 text-blue-800',
      draft: 'bg-gray-100 text-gray-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Campaigns</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-700">Failed to load campaigns: {error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      ) : !campaigns.length ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground mb-4">No campaigns yet. Create one to get started.</p>
          <button onClick={() => setShowCreate(true)} className="text-blue-600 hover:text-blue-700">
            Create your first campaign →
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/dashboard/campaigns/${campaign.id}`}
                className="block p-6 rounded-lg border bg-card hover:bg-muted transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{campaign.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Created {new Date(campaign.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Contacts</p>
                    <p className="text-2xl font-bold mt-1">{campaign.contacts_count ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Calls Made</p>
                    <p className="text-2xl font-bold mt-1">{campaign.calls_made ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Bookings</p>
                    <p className="text-2xl font-bold mt-1">{campaign.bookings_made ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Conversion</p>
                    <p className="text-2xl font-bold mt-1">{((campaign.conversion_rate ?? 0) * 100).toFixed(1)}%</p>
                  </div>
                  <div className="flex items-center justify-end">
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-6 flex justify-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded border disabled:opacity-50">Previous</button>
            <span className="px-4 py-2">Page {page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={campaigns.length < 50} className="px-4 py-2 rounded border disabled:opacity-50">Next</button>
          </div>
        </>
      )}

      {/* Create Campaign Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold">New Campaign</h2>
              <button onClick={() => { setShowCreate(false); setCreateError(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Campaign Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q2 Outreach"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Assistant ID</label>
                <input
                  type="text"
                  placeholder="Vapi assistant ID (leave blank for default)"
                  value={form.assistantId}
                  onChange={(e) => setForm({ ...form, assistantId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Call Window Start</label>
                  <input
                    type="time"
                    value={form.callingHoursStart}
                    onChange={(e) => setForm({ ...form, callingHoursStart: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Call Window End</label>
                  <input
                    type="time"
                    value={form.callingHoursEnd}
                    onChange={(e) => setForm({ ...form, callingHoursEnd: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Timezone</label>
                  <select
                    value={form.callingHoursTimezone}
                    onChange={(e) => setForm({ ...form, callingHoursTimezone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Calls/Day</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={form.maxCallsPerDay}
                    onChange={(e) => setForm({ ...form, maxCallsPerDay: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Voicemail Message</label>
                <textarea
                  rows={2}
                  placeholder="Message to leave if no answer..."
                  value={form.voicemailMessage}
                  onChange={(e) => setForm({ ...form, voicemailMessage: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setCreateError(null); }} className="px-4 py-2 rounded-lg border hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating || !form.name.trim()} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {creating ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
