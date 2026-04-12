'use client';

import { useEffect, useState } from 'react';
import { Phone, PhoneOutgoing, PhoneIncoming, Clock, CheckCircle } from 'lucide-react';

interface CallStats {
  inbound_count: number;
  outbound_count: number;
  total_duration: number;
  answer_rate: number;
  goal_achieved_count?: number;
  error?: string;
}

export function StatsBar() {
  const [stats, setStats] = useState<CallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const response = await fetch('/api/analytics/calls?period=today');
        if (!response.ok) throw new Error('Failed to fetch stats');
        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
        setStats(null);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Failed to load call statistics</p>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Calls',
      value: (stats?.inbound_count || 0) + (stats?.outbound_count || 0),
      icon: Phone,
      color: 'text-blue-600',
    },
    {
      label: 'Inbound',
      value: stats?.inbound_count || 0,
      icon: PhoneIncoming,
      color: 'text-green-600',
    },
    {
      label: 'Outbound',
      value: stats?.outbound_count || 0,
      icon: PhoneOutgoing,
      color: 'text-purple-600',
    },
    {
      label: 'Successful',
      value: stats?.goal_achieved_count || 0,
      icon: CheckCircle,
      color: 'text-emerald-600',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
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
  );
}
