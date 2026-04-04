/**
 * Caller Profile Card Component
 * Displays caller information, relationship score, and call history
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Calendar, TrendingUp, MessageSquare } from 'lucide-react';

export interface CallerProfile {
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
  tenantId?: string;
}

interface CallerProfileCardProps {
  caller: CallerProfile;
  onViewDetails?: (caller: CallerProfile) => void;
  onCallNow?: (caller: CallerProfile) => void;
  compact?: boolean;
}

export function CallerProfileCard({
  caller,
  onViewDetails,
  onCallNow,
  compact = false,
}: CallerProfileCardProps) {
  function getScoreColor(score: number): string {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
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

  if (compact) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold">
                  {caller.displayName || caller.phoneNumber}
                </h4>
                <Badge
                  variant="outline"
                  className={getScoreColor(caller.relationshipScore)}
                >
                  {caller.relationshipScore}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">
                {caller.callCount} calls • Last: {formatDaysAgo(caller.lastCallAt)}
              </p>
            </div>
            {onViewDetails && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewDetails(caller)}
              >
                View
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl mb-1">
              {caller.displayName || 'Unknown Caller'}
            </CardTitle>
            {caller.displayName && (
              <p className="text-sm text-gray-600">{caller.phoneNumber}</p>
            )}
          </div>
          <Badge className={getScoreColor(caller.relationshipScore)}>
            {getScoreLabel(caller.relationshipScore)} • {caller.relationshipScore}/100
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Relationship Score Visualization */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Relationship Strength
              </span>
              <span className="text-sm text-gray-600">
                {caller.relationshipScore}/100
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  caller.relationshipScore >= 80
                    ? 'bg-green-600'
                    : caller.relationshipScore >= 60
                    ? 'bg-blue-600'
                    : caller.relationshipScore >= 40
                    ? 'bg-yellow-600'
                    : 'bg-gray-600'
                }`}
                style={{ width: `${caller.relationshipScore}%` }}
              />
            </div>
          </div>

          {/* Call History Stats */}
          <div className="grid grid-cols-3 gap-4 py-3 border-t border-b">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Phone className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Calls</span>
              </div>
              <p className="text-lg font-semibold">{caller.callCount}</p>
            </div>

            <div className="text-center border-l border-r">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">First</span>
              </div>
              <p className="text-xs font-medium">{formatDate(caller.firstCallAt)}</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Last</span>
              </div>
              <p className="text-xs font-medium">{formatDaysAgo(caller.lastCallAt)}</p>
            </div>
          </div>

          {/* Summary */}
          {caller.summary && (
            <div>
              <div className="flex items-center gap-1 mb-2">
                <MessageSquare className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Summary</span>
              </div>
              <p className="text-sm text-gray-700 line-clamp-3">{caller.summary}</p>
            </div>
          )}

          {/* Last Offer */}
          {caller.lastOfferMade && (
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm font-medium mb-1">Last Offer</p>
              <p className="text-sm text-gray-700">{caller.lastOfferMade}</p>
              {caller.lastOfferOutcome && (
                <Badge variant="secondary" className="mt-2">
                  {caller.lastOfferOutcome}
                </Badge>
              )}
            </div>
          )}

          {/* Preferences */}
          {caller.preferences && Object.keys(caller.preferences).length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Preferences</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(caller.preferences).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {key}: {String(value)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {caller.notes && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-1">Notes</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-4">
                {caller.notes}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {onCallNow && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onCallNow(caller)}
                className="flex-1"
              >
                <Phone className="w-4 h-4 mr-1" />
                Call Now
              </Button>
            )}
            {onViewDetails && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(caller)}
                className="flex-1"
              >
                View Full Profile
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Mini version for use in sidebars or lists
 */
export function CallerProfileMini({ caller }: { caller: CallerProfile }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
        <Phone className="w-5 h-5 text-blue-600" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {caller.displayName || caller.phoneNumber}
        </p>
        <p className="text-xs text-gray-500">
          {caller.callCount} calls • Score: {caller.relationshipScore}
        </p>
      </div>

      <Badge
        variant="outline"
        className={
          caller.relationshipScore >= 70
            ? 'bg-green-50 text-green-700 border-green-200'
            : caller.relationshipScore >= 50
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-gray-50 text-gray-700 border-gray-200'
        }
      >
        {caller.relationshipScore}
      </Badge>
    </div>
  );
}
