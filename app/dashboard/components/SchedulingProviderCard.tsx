/**
 * Feature 217: SchedulingProviderCard Component
 * Displays provider name, configuration status, and last booking info
 * Reusable card for showing scheduling provider details on the dashboard
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ProviderCardProps {
  name: string
  displayName: string
  status: 'active' | 'configured' | 'not-configured' | 'error'
  description?: string
  lastBooking?: {
    id: string
    customer_name: string
    start_time: string
    created_at: string
  } | null
  healthCheck?: {
    healthy: boolean
    error?: string
  }
  onConnect?: () => void
  onConfigure?: () => void
}

export function SchedulingProviderCard({
  name,
  displayName,
  status,
  description,
  lastBooking,
  healthCheck,
  onConnect,
  onConfigure,
}: ProviderCardProps) {
  const getStatusBadge = () => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600">Active</Badge>
      case 'configured':
        return <Badge className="bg-blue-600">Configured</Badge>
      case 'not-configured':
        return <Badge variant="outline">Not Configured</Badge>
      case 'error':
        return <Badge className="bg-red-600">Error</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  return (
    <Card className={`${status === 'active' ? 'border-green-500' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{displayName}</CardTitle>
          {getStatusBadge()}
        </div>
        {description && (
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Health Status */}
        {healthCheck && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Health:</span>
            <span
              className={`text-sm ${
                healthCheck.healthy ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {healthCheck.healthy ? '✓ Healthy' : '✗ Unhealthy'}
            </span>
          </div>
        )}

        {healthCheck?.error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {healthCheck.error}
          </div>
        )}

        {/* Last Booking */}
        {lastBooking ? (
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Last Booking:</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Customer:</span>
                <span className="font-medium">{lastBooking.customer_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Scheduled:</span>
                <span className="text-gray-800">
                  {formatDateTime(lastBooking.start_time)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Booked at:</span>
                <span className="text-gray-500 text-xs">
                  {formatDateTime(lastBooking.created_at)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500 italic">No bookings yet</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          {status === 'not-configured' && onConnect && (
            <button
              onClick={onConnect}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
            >
              Connect {displayName}
            </button>
          )}
          {onConfigure && (
            <button
              onClick={onConfigure}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition"
            >
              Configure
            </button>
          )}
        </div>

        {/* Provider-specific connection instructions */}
        {status === 'not-configured' && name === 'google-calendar' && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            <p className="font-medium text-blue-900 mb-1">Quick Setup:</p>
            <ol className="list-decimal list-inside text-blue-800 space-y-1">
              <li>Click "Connect Google Calendar"</li>
              <li>Sign in with your Google account</li>
              <li>Grant calendar access permissions</li>
              <li>You're ready to book appointments!</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
