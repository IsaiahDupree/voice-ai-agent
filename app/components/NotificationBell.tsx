'use client'

import { useState, useEffect, useRef } from 'react'
import { supabaseAdmin } from '@/lib/supabase'

// F0736: Notification bell with unread alert count
interface Notification {
  id: string
  type: 'call_dropped' | 'booking_failed' | 'handoff_requested' | 'low_balance' | 'campaign_complete'
  title: string
  message: string
  timestamp: string
  read: boolean
  actionUrl?: string
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    loadNotifications()

    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      // In real implementation, this would fetch from a notifications table
      // For now, we'll check for recent events that should trigger notifications

      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

      const mockNotifications: Notification[] = []

      // Check for dropped calls
      const { data: droppedCalls } = await supabaseAdmin
        .from('voice_agent_calls')
        .select('id, created_at, phone_number')
        .eq('status', 'failed')
        .gte('created_at', thirtyMinutesAgo)
        .limit(5)

      if (droppedCalls) {
        droppedCalls.forEach((call) => {
          mockNotifications.push({
            id: `call-${call.id}`,
            type: 'call_dropped',
            title: 'Call Dropped',
            message: `Call to ${call.phone_number} failed`,
            timestamp: call.created_at,
            read: false,
            actionUrl: `/dashboard?callId=${call.id}`,
          })
        })
      }

      // Check for failed bookings
      const { data: failedBookings } = await supabaseAdmin
        .from('bookings')
        .select('id, created_at, contact_phone')
        .eq('status', 'failed')
        .gte('created_at', thirtyMinutesAgo)
        .limit(5)

      if (failedBookings) {
        failedBookings.forEach((booking) => {
          mockNotifications.push({
            id: `booking-${booking.id}`,
            type: 'booking_failed',
            title: 'Booking Failed',
            message: `Failed to book appointment for ${booking.contact_phone}`,
            timestamp: booking.created_at,
            read: false,
            actionUrl: `/dashboard?bookingId=${booking.id}`,
          })
        })
      }

      // Sort by timestamp (newest first)
      mockNotifications.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      setNotifications(mockNotifications)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'call_dropped':
        return '📞'
      case 'booking_failed':
        return '📅'
      case 'handoff_requested':
        return '🤝'
      case 'low_balance':
        return '💳'
      case 'campaign_complete':
        return '✅'
      default:
        return '🔔'
    }
  }

  const getRelativeTime = (timestamp: string) => {
    const now = Date.now()
    const then = new Date(timestamp).getTime()
    const diffInSeconds = Math.floor((now - then) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <svg
          className="h-6 w-6 text-gray-700 dark:text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-medium text-primary hover:text-primary-dark transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <h4 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  No notifications
                </h4>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  You're all caught up!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {notifications.map((notification) => (
                  <a
                    key={notification.id}
                    href={notification.actionUrl}
                    onClick={() => markAsRead(notification.id)}
                    className={`block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 text-2xl">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="h-2 w-2 bg-primary rounded-full flex-shrink-0 mt-1"></div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {getRelativeTime(notification.timestamp)}
                        </p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-center">
              <button
                onClick={() => {
                  setIsOpen(false)
                  window.location.href = '/dashboard/notifications'
                }}
                className="text-sm font-medium text-primary hover:text-primary-dark transition-colors"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
