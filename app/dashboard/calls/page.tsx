'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Filter } from 'lucide-react';

interface Call {
  id: string;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  outcome: string;
  duration: number;
  started_at: string;
  goal_achieved: boolean;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function fetchCalls() {
      try {
        setLoading(true);
        let url = `/api/calls?limit=50&offset=${(page - 1) * 50}`;
        if (filter !== 'all') {
          url += `&direction=${filter}`;
        }
        if (outcomeFilter !== 'all') {
          url += `&outcome=${outcomeFilter}`;
        }

        const response = await fetch(url);
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
  }, [page, filter, outcomeFilter]);

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

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Calls</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Failed to load calls: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Calls</h1>

      {/* Filters */}
      <div className="mb-6 p-4 rounded-lg border bg-card flex gap-4 items-center flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded border bg-background text-sm"
        >
          <option value="all">All Directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
        <select
          value={outcomeFilter}
          onChange={(e) => {
            setOutcomeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded border bg-background text-sm"
        >
          <option value="all">All Outcomes</option>
          <option value="answered">Answered</option>
          <option value="no_answer">No Answer</option>
          <option value="voicemail">Voicemail</option>
          <option value="booking_made">Booking Made</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      ) : !calls.length ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">No calls found</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Direction</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Outcome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {calls.map((call) => (
                    <tr key={call.id} className="hover:bg-muted transition-colors">
                      <td className="px-6 py-4 text-sm font-medium">{call.phone_number}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getDirectionBadge(call.direction)}`}>
                          {call.direction}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getOutcomeBadge(call.outcome)}`}>
                          {call.outcome}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">{call.duration}s</td>
                      <td className="px-6 py-4 text-sm">{new Date(call.started_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        {call.goal_achieved && (
                          <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                            ✓ Goal
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/dashboard/calls/${call.id}`} className="text-blue-600 hover:text-blue-700">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex justify-center gap-2">
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
              disabled={calls.length < 50}
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
