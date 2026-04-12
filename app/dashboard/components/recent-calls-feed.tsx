'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Clock } from 'lucide-react';

interface Call {
  id: string;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  outcome: string;
  duration: number;
  started_at: string;
  goal_achieved: boolean;
}

export function RecentCallsFeed() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCalls() {
      try {
        setLoading(true);
        const response = await fetch('/api/calls?limit=5');
        if (!response.ok) throw new Error('Failed to fetch calls');
        const data = await response.json();
        setCalls(Array.isArray(data) ? data : data.calls || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load calls');
        setCalls([]);
      } finally {
        setLoading(false);
      }
    }

    fetchCalls();
  }, []);

  const getDirectionBadge = (direction: string) => {
    const badges: Record<string, string> = {
      inbound: 'bg-green-100 text-green-800',
      outbound: 'bg-blue-100 text-blue-800',
    };
    return badges[direction] || 'bg-gray-100 text-gray-800';
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
      <div className="rounded-lg border bg-card p-6">
        <div className="h-6 bg-muted rounded w-32 mb-4"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Recent Calls</h3>
        <p className="text-sm text-red-600">Failed to load calls</p>
      </div>
    );
  }

  if (!calls.length) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Recent Calls</h3>
        <p className="text-sm text-muted-foreground">No calls yet. Configure your agent to start calling.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="font-semibold mb-4">Recent Calls</h3>
      <div className="space-y-2">
        {calls.map((call) => (
          <Link
            key={call.id}
            href={`/dashboard/calls/${call.id}`}
            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getDirectionBadge(call.direction)}`}>
                  {call.direction}
                </span>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getOutcomeBadge(call.outcome)}`}>
                  {call.outcome}
                </span>
                {call.goal_achieved && (
                  <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                    ✓ Goal
                  </span>
                )}
              </div>
              <p className="font-medium text-sm">{call.phone_number}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                {call.duration}s • {new Date(call.started_at).toLocaleDateString()}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground ml-2 flex-shrink-0" />
          </Link>
        ))}
      </div>
      <Link
        href="/dashboard/calls"
        className="text-sm text-blue-600 hover:underline mt-4 inline-block"
      >
        View All Calls →
      </Link>
    </div>
  );
}
