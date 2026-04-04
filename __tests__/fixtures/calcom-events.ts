// F1237: Cal.com booking event fixture

/**
 * F1237: Cal.com booking webhook - booking created
 */
export const calcomBookingCreated = {
  triggerEvent: 'BOOKING_CREATED',
  createdAt: new Date().toISOString(),
  payload: {
    id: 12345,
    uid: 'abc123def456',
    title: 'Consultation Call',
    description: 'Initial consultation about AI automation',
    startTime: '2026-04-15T14:00:00Z',
    endTime: '2026-04-15T15:00:00Z',
    status: 'ACCEPTED',
    attendees: [
      {
        name: 'John Doe',
        email: 'john@example.com',
        timeZone: 'America/New_York',
      },
    ],
    organizer: {
      name: 'Voice AI Agent',
      email: 'agent@voiceai.com',
      timeZone: 'America/New_York',
    },
    location: 'Phone Call',
    metadata: {
      phone: '+15555551234',
      source: 'vapi',
      callId: 'test-call-123',
    },
  },
}

/**
 * Cal.com booking webhook - booking rescheduled
 */
export const calcomBookingRescheduled = {
  triggerEvent: 'BOOKING_RESCHEDULED',
  createdAt: new Date().toISOString(),
  payload: {
    id: 12345,
    uid: 'abc123def456',
    title: 'Consultation Call',
    startTime: '2026-04-16T10:00:00Z', // Changed date/time
    endTime: '2026-04-16T11:00:00Z',
    status: 'ACCEPTED',
    attendees: [
      {
        name: 'John Doe',
        email: 'john@example.com',
        timeZone: 'America/New_York',
      },
    ],
    organizer: {
      name: 'Voice AI Agent',
      email: 'agent@voiceai.com',
      timeZone: 'America/New_York',
    },
    rescheduleReason: 'Customer requested different time',
  },
}

/**
 * Cal.com booking webhook - booking cancelled
 */
export const calcomBookingCancelled = {
  triggerEvent: 'BOOKING_CANCELLED',
  createdAt: new Date().toISOString(),
  payload: {
    id: 12345,
    uid: 'abc123def456',
    title: 'Consultation Call',
    startTime: '2026-04-15T14:00:00Z',
    endTime: '2026-04-15T15:00:00Z',
    status: 'CANCELLED',
    cancellationReason: 'Customer no longer interested',
    attendees: [
      {
        name: 'John Doe',
        email: 'john@example.com',
        timeZone: 'America/New_York',
      },
    ],
  },
}

/**
 * Cal.com API response - available slots
 */
export const calcomAvailableSlots = {
  slots: {
    '2026-04-15': [
      {
        time: '2026-04-15T09:00:00Z',
        attendees: [],
        bookingUid: null,
        users: [1234],
      },
      {
        time: '2026-04-15T10:00:00Z',
        attendees: [],
        bookingUid: null,
        users: [1234],
      },
      {
        time: '2026-04-15T14:00:00Z',
        attendees: [],
        bookingUid: null,
        users: [1234],
      },
      {
        time: '2026-04-15T15:00:00Z',
        attendees: [],
        bookingUid: null,
        users: [1234],
      },
    ],
  },
}

/**
 * Cal.com API response - booking created
 */
export const calcomBookingResponse = {
  id: 12345,
  uid: 'abc123def456',
  title: 'Consultation Call',
  description: 'Initial consultation about AI automation',
  startTime: '2026-04-15T14:00:00Z',
  endTime: '2026-04-15T15:00:00Z',
  status: 'ACCEPTED',
  metadata: {
    phone: '+15555551234',
    source: 'vapi',
    callId: 'test-call-123',
  },
}
