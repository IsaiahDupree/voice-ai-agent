'use client';

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';

interface PerformanceData {
  conversion_rate: number;
  avg_call_duration: number;
  goal_achieved_count: number;
  booking_show_rate: number;
}

export function PerformanceWidget() {
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPerformance() {
      try {
        setLoading(true);
        const [conversionRes, callsRes] = await Promise.all([
          fetch('/api/analytics/conversion'),
          fetch('/api/analytics/calls'),
        ]);

        if (!conversionRes.ok || !callsRes.ok) throw new Error('Failed to fetch performance data');

        const conversionData = await conversionRes.json();
        const callsData = await callsRes.json();

        setPerformance({
          conversion_rate: conversionData.conversion_rate || 0,
          avg_call_duration: conversionData.avg_call_duration || 0,
          goal_achieved_count: callsData.goal_achieved_count || 0,
          booking_show_rate: conversionData.booking_show_rate || 0,
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load performance data');
        setPerformance(null);
      } finally {
        setLoading(false);
      }
    }

    fetchPerformance();
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="h-6 bg-muted rounded w-32 mb-4"></div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Performance Metrics</h3>
        <p className="text-sm text-red-600">Failed to load performance data</p>
      </div>
    );
  }

  const metrics = [
    {
      label: 'Conversion Rate',
      value: `${(performance?.conversion_rate || 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-emerald-600',
    },
    {
      label: 'Avg Call Duration',
      value: `${Math.round(performance?.avg_call_duration || 0)}s`,
      icon: TrendingUp,
      color: 'text-blue-600',
    },
    {
      label: 'Successful Conversations',
      value: performance?.goal_achieved_count || 0,
      icon: TrendingUp,
      color: 'text-purple-600',
    },
    {
      label: 'Booking Show Rate',
      value: `${(performance?.booking_show_rate || 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="font-semibold mb-6">Performance Metrics</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="p-4 rounded-lg bg-muted">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="text-2xl font-bold mt-2">{metric.value}</p>
                </div>
                <Icon className={`w-5 h-5 ${metric.color}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
