'use client';

/**
 * Caller Memory Dashboard Page
 * View and edit caller profiles with relationship scores and history
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CallerProfile {
  id: number;
  phoneNumber: string;
  displayName?: string;
  callCount: number;
  firstCallAt: string;
  lastCallAt: string;
  summary?: string;
  preferences?: Record<string, any>;
  relationshipScore: number;
  lastOfferMade?: string;
  lastOfferOutcome?: string;
  notes?: string;
}

export default function CallerMemoryPage() {
  const [callers, setCallers] = useState<CallerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCaller, setSelectedCaller] = useState<CallerProfile | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'recent' | 'calls'>('score');

  useEffect(() => {
    loadCallers();
  }, []);

  async function loadCallers() {
    setLoading(true);
    try {
      const response = await fetch('/api/memory/callers');
      if (response.ok) {
        const data = await response.json();
        setCallers(data.callers || []);
      }
    } catch (error) {
      console.error('Failed to load callers:', error);
    } finally {
      setLoading(false);
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-gray-600';
  }

  function getScoreLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Moderate';
    if (score >= 20) return 'Low';
    return 'Very Low';
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatDaysAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  }

  // Filter and sort callers
  const filteredCallers = callers
    .filter(
      (caller) =>
        caller.phoneNumber.includes(searchQuery) ||
        caller.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'score') {
        return b.relationshipScore - a.relationshipScore;
      } else if (sortBy === 'recent') {
        return new Date(b.lastCallAt).getTime() - new Date(a.lastCallAt).getTime();
      } else {
        return b.callCount - a.callCount;
      }
    });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Caller Memory</h1>
        <p className="text-gray-600">
          View and manage caller profiles with relationship tracking
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Callers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{callers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              High Value (80+)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {callers.filter((c) => c.relationshipScore >= 80).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active (60-79)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {callers.filter((c) => c.relationshipScore >= 60 && c.relationshipScore < 80).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Needs Nurturing (&lt;60)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {callers.filter((c) => c.relationshipScore < 60).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <Input
              placeholder="Search by phone number or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />

            <div className="flex gap-2">
              <Button
                variant={sortBy === 'score' ? 'default' : 'outline'}
                onClick={() => setSortBy('score')}
                size="sm"
              >
                By Score
              </Button>
              <Button
                variant={sortBy === 'recent' ? 'default' : 'outline'}
                onClick={() => setSortBy('recent')}
                size="sm"
              >
                Recent
              </Button>
              <Button
                variant={sortBy === 'calls' ? 'default' : 'outline'}
                onClick={() => setSortBy('calls')}
                size="sm"
              >
                Most Calls
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Callers List */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Loading callers...
          </CardContent>
        </Card>
      ) : filteredCallers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            {searchQuery ? 'No callers match your search.' : 'No callers yet.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredCallers.map((caller) => (
            <Card
              key={caller.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedCaller(caller)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">
                        {caller.displayName || caller.phoneNumber}
                      </h3>
                      <Badge
                        variant="outline"
                        className={getScoreColor(caller.relationshipScore)}
                      >
                        Score: {caller.relationshipScore}/100
                      </Badge>
                      <Badge variant="secondary">
                        {getScoreLabel(caller.relationshipScore)}
                      </Badge>
                    </div>

                    {caller.displayName && (
                      <p className="text-sm text-gray-600 mb-2">{caller.phoneNumber}</p>
                    )}

                    <div className="flex gap-4 text-sm text-gray-600 mb-3">
                      <span>{caller.callCount} calls</span>
                      <span>Last: {formatDaysAgo(caller.lastCallAt)}</span>
                      <span>First: {formatDate(caller.firstCallAt)}</span>
                    </div>

                    {caller.summary && (
                      <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                        {caller.summary}
                      </p>
                    )}

                    {caller.lastOfferMade && (
                      <div className="text-sm">
                        <span className="text-gray-600">Last offer: </span>
                        <span className="font-medium">{caller.lastOfferMade}</span>
                        {caller.lastOfferOutcome && (
                          <Badge variant="secondary" className="ml-2">
                            {caller.lastOfferOutcome}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Selected Caller Modal */}
      {selectedCaller && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedCaller(null)}
        >
          <Card
            className="max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{selectedCaller.displayName || selectedCaller.phoneNumber}</span>
                <Button variant="ghost" onClick={() => setSelectedCaller(null)} size="sm">
                  Close
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Contact Information</h4>
                  <p className="text-sm text-gray-600">{selectedCaller.phoneNumber}</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Relationship Score</h4>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getScoreColor(selectedCaller.relationshipScore).replace('text-', 'bg-')}`}
                        style={{ width: `${selectedCaller.relationshipScore}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {selectedCaller.relationshipScore}/100
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Call History</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Total Calls</p>
                      <p className="font-semibold">{selectedCaller.callCount}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">First Call</p>
                      <p className="font-semibold">{formatDate(selectedCaller.firstCallAt)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Last Call</p>
                      <p className="font-semibold">{formatDate(selectedCaller.lastCallAt)}</p>
                    </div>
                  </div>
                </div>

                {selectedCaller.summary && (
                  <div>
                    <h4 className="font-semibold mb-2">Summary</h4>
                    <p className="text-sm text-gray-700">{selectedCaller.summary}</p>
                  </div>
                )}

                {selectedCaller.preferences && Object.keys(selectedCaller.preferences).length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Preferences</h4>
                    <div className="space-y-1">
                      {Object.entries(selectedCaller.preferences).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="text-gray-600">{key}: </span>
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCaller.notes && (
                  <div>
                    <h4 className="font-semibold mb-2">Notes</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedCaller.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
