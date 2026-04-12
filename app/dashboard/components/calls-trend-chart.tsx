'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DayData {
  date: string;
  inbound: number;
  outbound: number;
}

export function CallsTrendChart() {
  const [data, setData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrendData() {
      try {
        setLoading(true);
        const response = await fetch('/api/analytics/calls?period=7days');
        if (!response.ok) throw new Error('Failed to fetch analytics');
        const rawData = await response.json();

        // Transform data into daily inbound/outbound counts
        const dailyData: Record<string, { inbound: number; outbound: number }> = {};

        if (Array.isArray(rawData)) {
          rawData.forEach((item: any) => {
            const date = new Date(item.started_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });
            if (!dailyData[date]) {
              dailyData[date] = { inbound: 0, outbound: 0 };
            }
            if (item.direction === 'inbound') {
              dailyData[date].inbound += 1;
            } else if (item.direction === 'outbound') {
              dailyData[date].outbound += 1;
            }
          });
        } else if (rawData.daily) {
          // If API returns daily aggregated data
          Object.entries(rawData.daily).forEach(([date, counts]: [string, any]) => {
            dailyData[date] = {
              inbound: counts.inbound || 0,
              outbound: counts.outbound || 0,
            };
          });
        }

        const sortedData = Object.entries(dailyData)
          .map(([date, counts]) => ({ date, ...counts }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setData(sortedData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchTrendData();
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Calls Trend (7 Days)</h3>
        <div className="h-80 bg-muted rounded animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Calls Trend (7 Days)</h3>
        <p className="text-sm text-red-600">Failed to load analytics: {error}</p>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Calls Trend (7 Days)</h3>
        <p className="text-sm text-muted-foreground">No call data available for the last 7 days.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="font-semibold mb-4">Calls Trend (7 Days)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="inbound" fill="#10b981" name="Inbound" />
          <Bar dataKey="outbound" fill="#3b82f6" name="Outbound" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
