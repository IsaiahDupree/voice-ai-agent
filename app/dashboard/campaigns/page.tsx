'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ChevronRight } from 'lucide-react';

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

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
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

    fetchCampaigns();
  }, [page]);

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
          onClick={() => alert('Create campaign feature coming soon')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-700">Failed to load campaigns: {error}</p>
        </div>
      )}

      {/* Campaigns List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      ) : !campaigns.length ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground mb-4">No campaigns yet. Create one to get started.</p>
          <button className="text-blue-600 hover:text-blue-700">
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
                    <p className="text-2xl font-bold mt-1">{campaign.contacts_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Calls Made</p>
                    <p className="text-2xl font-bold mt-1">{campaign.calls_made}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Bookings</p>
                    <p className="text-2xl font-bold mt-1">{campaign.bookings_made}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Conversion</p>
                    <p className="text-2xl font-bold mt-1">{(campaign.conversion_rate * 100).toFixed(1)}%</p>
                  </div>
                  <div className="flex items-center justify-end">
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded border disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-4 py-2">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={campaigns.length < 50}
              className="px-4 py-2 rounded border disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
