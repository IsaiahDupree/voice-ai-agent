'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pause, Play } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
  contacts_count: number;
  calls_made: number;
  bookings_made: number;
  conversion_rate: number;
  created_at: string;
  description?: string;
}

interface CallHistory {
  id: string;
  phone_number: string;
  direction: string;
  outcome: string;
  duration: number;
  started_at: string;
  goal_achieved: boolean;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [calls, setCalls] = useState<CallHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function fetchCampaignDetail() {
      try {
        setLoading(true);

        const [campaignRes, callsRes] = await Promise.all([
          fetch(`/api/campaigns/${campaignId}`),
          fetch(`/api/calls?campaign_id=${campaignId}&limit=20`),
        ]);

        if (!campaignRes.ok) throw new Error('Failed to fetch campaign');

        const campaignData = await campaignRes.json();
        setCampaign(campaignData);

        if (callsRes.ok) {
          const callsData = await callsRes.json();
          setCalls(Array.isArray(callsData) ? callsData : callsData.calls || []);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaign');
        setCampaign(null);
        setCalls([]);
      } finally {
        setLoading(false);
      }
    }

    fetchCampaignDetail();
  }, [campaignId]);

  const handleToggleStatus = async () => {
    if (!campaign) return;

    try {
      setActionLoading(true);
      const newStatus = campaign.status === 'active' ? 'paused' : 'active';

      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update campaign');

      const updatedCampaign = await response.json();
      setCampaign(updatedCampaign);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-blue-100 text-blue-800',
      draft: 'bg-gray-100 text-gray-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-700';
  };

  const getOutcomeBadge = (outcome: string) => {
    const badges: Record<string, string> = {
      booking_made: 'bg-emerald-100 text-emerald-700',
      answered: 'bg-blue-100 text-blue-700',
      voicemail: 'bg-gray-100 text-gray-600',
      no_answer: 'bg-red-100 text-red-700',
    };
    return badges[outcome] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Campaigns
        </button>
        <div className="space-y-4">
          <div className="h-12 bg-muted rounded animate-pulse"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Campaigns
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-red-700">Failed to load campaign: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Campaigns
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <p className="text-muted-foreground mt-2">
            {campaign.description || 'No description provided'}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Created {new Date(campaign.created_at).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={handleToggleStatus}
          disabled={actionLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            campaign.status === 'active'
              ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
              : 'bg-green-100 text-green-800 hover:bg-green-200'
          } disabled:opacity-50`}
        >
          {campaign.status === 'active' ? (
            <>
              <Pause className="w-4 h-4" />
              Pause Campaign
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Resume Campaign
            </>
          )}
        </button>
      </div>

      {/* Status Badge */}
      <div className="mb-8">
        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(campaign.status)}`}>
          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground uppercase">Contacts</p>
          <p className="text-3xl font-bold mt-2">{campaign.contacts_count}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground uppercase">Calls Made</p>
          <p className="text-3xl font-bold mt-2">{campaign.calls_made}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground uppercase">Bookings</p>
          <p className="text-3xl font-bold mt-2">{campaign.bookings_made}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground uppercase">Conversion</p>
          <p className="text-3xl font-bold mt-2">{(campaign.conversion_rate * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* Call History */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Calls</h2>

        {!calls.length ? (
          <p className="text-muted-foreground">No calls made for this campaign yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Phone</th>
                  <th className="text-left py-3 px-4 font-semibold">Direction</th>
                  <th className="text-left py-3 px-4 font-semibold">Outcome</th>
                  <th className="text-left py-3 px-4 font-semibold">Duration</th>
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4">{call.phone_number}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          call.direction === 'inbound'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {call.direction}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getOutcomeBadge(call.outcome)}`}>
                        {call.outcome}
                      </span>
                    </td>
                    <td className="py-3 px-4">{call.duration}s</td>
                    <td className="py-3 px-4">{new Date(call.started_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      {call.goal_achieved && (
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                          ✓ Success
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
