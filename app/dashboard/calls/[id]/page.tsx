'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Phone, MessageSquare } from 'lucide-react';

interface CallDetail {
  id: string;
  phone_number: string;
  direction: string;
  outcome: string;
  duration: number;
  started_at: string;
  ended_at: string;
  goal_achieved: boolean;
  sentiment_score: number;
}

interface Transcript {
  id: string;
  call_id: string;
  speaker: string;
  text: string;
  timestamp: number;
}

export default function CallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.id as string;

  const [call, setCall] = useState<CallDetail | null>(null);
  const [transcript, setTranscript] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCallDetail() {
      try {
        setLoading(true);

        // Fetch call details and transcript in parallel
        const [callRes, transcriptRes] = await Promise.all([
          fetch(`/api/calls/${callId}`),
          fetch(`/api/transcripts?call_id=${callId}`),
        ]);

        if (!callRes.ok) throw new Error('Failed to fetch call details');

        const callData = await callRes.json();
        setCall(callData);

        if (transcriptRes.ok) {
          const transcriptData = await transcriptRes.json();
          setTranscript(Array.isArray(transcriptData) ? transcriptData : transcriptData.transcript || []);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load call details');
        setCall(null);
      } finally {
        setLoading(false);
      }
    }

    if (callId) {
      fetchCallDetail();
    }
  }, [callId]);

  if (loading) {
    return (
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Calls
        </button>
        <div className="space-y-4">
          <div className="h-32 bg-muted rounded animate-pulse"></div>
          <div className="h-96 bg-muted rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Calls
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error || 'Call not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Calls
      </button>

      {/* Call Header */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{call.phone_number}</h1>
            <p className="text-muted-foreground mt-2">
              {new Date(call.started_at).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            {call.goal_achieved && (
              <span className="inline-block px-3 py-1 rounded-lg text-sm font-medium bg-emerald-100 text-emerald-700">
                ✓ Goal Achieved
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Direction</p>
            <p className="text-lg font-semibold mt-1">{call.direction}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Outcome</p>
            <p className="text-lg font-semibold mt-1">{call.outcome}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Duration
            </p>
            <p className="text-lg font-semibold mt-1">{call.duration}s</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Sentiment</p>
            <p className="text-lg font-semibold mt-1">{(call.sentiment_score * 100).toFixed(0)}%</p>
          </div>
        </div>
      </div>

      {/* Transcript */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Transcript
        </h2>

        {!transcript.length ? (
          <p className="text-muted-foreground text-sm">No transcript available</p>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {transcript.map((item, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="flex-shrink-0">
                  <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-muted">
                    {item.speaker}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm">{item.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.floor(item.timestamp / 1000)}s
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
