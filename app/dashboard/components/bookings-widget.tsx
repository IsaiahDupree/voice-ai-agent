'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar } from 'lucide-react';

interface Booking {
  id: string;
  contact_name: string;
  start_time: string;
  status: string;
}

export function BookingsWidget() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBookings() {
      try {
        setLoading(true);
        const response = await fetch('/api/bookings?limit=5');
        if (!response.ok) throw new Error('Failed to fetch bookings');
        const data = await response.json();
        setBookings(Array.isArray(data) ? data : data.bookings || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bookings');
        setBookings([]);
      } finally {
        setLoading(false);
      }
    }

    fetchBookings();
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="h-6 bg-muted rounded w-32 mb-4"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Bookings</h3>
        <p className="text-sm text-red-600">Failed to load bookings</p>
      </div>
    );
  }

  if (!bookings.length) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Bookings</h3>
        <p className="text-sm text-muted-foreground">No bookings scheduled. Calls that convert will appear here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="font-semibold mb-4">Upcoming Bookings</h3>
      <div className="space-y-3">
        {bookings.map((booking) => (
          <div key={booking.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted transition-colors">
            <Calendar className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{booking.contact_name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(booking.start_time).toLocaleString()}
              </p>
            </div>
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
              booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {booking.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
