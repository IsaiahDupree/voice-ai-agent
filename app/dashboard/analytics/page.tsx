'use client';

import { useEffect, useState } from 'react';
import { Phone, CheckCircle, TrendingUp } from 'lucide-react';

interface AnalyticsStats {
  totalCalls: number;
  activeCalls: number;
  totalBookings: number;
  conversionRate: number;
  smsSent: number;
}

interface CallData {
  id: string;
  phone_number: string;
  outcome: string;
  started_at: string;
  duration: number;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [calls, setCalls] = useState<CallData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        const [statsRes, callsRes] = await Promise.all([
          fetch('/api/analytics/stats'),
          fetch('/api/calls?limit=10'),
        ]);

        if (!statsRes.ok || !callsRes.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const statsData = await statsRes.json();
        const callsData = await callsRes.json();

        setStats(statsData);
        setCalls(Array.isArray(callsData) ? callsData : callsData.calls || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
        setStats(null);
        setCalls([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Analytics</h1>
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Analytics</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Failed to load analytics: {error}</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Calls',
      value: stats?.totalCalls || 0,
      icon: Phone,
      color: 'text-blue-600',
    },
    {
      label: 'Bookings',
      value: stats?.totalBookings || 0,
      icon: CheckCircle,
      color: 'text-green-600',
    },
    {
      label: 'Conversion Rate',
      value: `${(stats?.conversionRate || 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-2">Overview of your AI voice agent performance</p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold mt-2">{card.value}</p>
                </div>
                <Icon className={`w-8 h-8 ${card.color} opacity-20`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Calls Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted">
          <h2 className="text-lg font-semibold">Recent Calls</h2>
        </div>
        {!calls.length ? (
          <div className="px-6 py-8 text-center">
            <p className="text-muted-foreground">No calls found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Outcome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {calls.map((call) => (
                  <tr key={call.id} className="hover:bg-muted transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">{call.phone_number}</td>
                    <td className="px-6 py-4 text-sm">{call.outcome || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm">{call.duration}s</td>
                    <td className="px-6 py-4 text-sm">{new Date(call.started_at).toLocaleDateString()}</td>
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
