'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
  contacts_count: number;
  calls_made: number;
  conversion_rate: number;
}

export function CampaignsWidget() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        setLoading(true);
        const response = await fetch('/api/campaigns?status=active&limit=5');
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

    fetchCampaigns();
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="h-6 bg-muted rounded w-32 mb-4"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Active Campaigns</h3>
        <p className="text-sm text-red-600">Failed to load campaigns</p>
      </div>
    );
  }

  if (!campaigns.length) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Active Campaigns</h3>
        <p className="text-sm text-muted-foreground">No active campaigns. Start a new campaign to begin.</p>
        <Link href="/dashboard/campaigns" className="text-sm text-blue-600 hover:underline mt-4 inline-block">
          Create Campaign →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="font-semibold mb-4">Active Campaigns</h3>
      <div className="space-y-3">
        {campaigns.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/dashboard/campaigns/${campaign.id}`}
            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <div className="flex-1">
              <p className="font-medium text-sm">{campaign.name}</p>
              <p className="text-xs text-muted-foreground">
                {campaign.calls_made} calls • {(campaign.conversion_rate * 100).toFixed(1)}% conversion
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
      <Link
        href="/dashboard/campaigns"
        className="text-sm text-blue-600 hover:underline mt-4 inline-block"
      >
        View All Campaigns →
      </Link>
    </div>
  );
}
