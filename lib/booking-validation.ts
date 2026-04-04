// F0294: Minimum notice enforcement
// F0295: Maximum notice enforcement
// Booking time validation utilities

/**
 * F0294: Check if booking meets minimum notice requirement
 * Default: 2 hours minimum notice
 */
export function meetsMinimumNotice(
  startTime: string,
  minimumNoticeHours: number = 2
): { valid: boolean; error?: string; hoursUntil?: number } {
  const now = new Date();
  const start = new Date(startTime);
  const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil < minimumNoticeHours) {
    return {
      valid: false,
      error: `Minimum notice of ${minimumNoticeHours} hours required. Booking is only ${hoursUntil.toFixed(
        1
      )} hours away.`,
      hoursUntil
    };
  }

  return {
    valid: true,
    hoursUntil
  };
}

/**
 * F0295: Check if booking is within maximum future booking window
 * Default: 90 days maximum
 */
export function meetsMaximumNotice(
  startTime: string,
  maximumNoticeDays: number = 90
): { valid: boolean; error?: string; daysUntil?: number } {
  const now = new Date();
  const start = new Date(startTime);
  const daysUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntil > maximumNoticeDays) {
    return {
      valid: false,
      error: `Maximum booking window is ${maximumNoticeDays} days. Booking is ${daysUntil.toFixed(
        0
      )} days away.`,
      daysUntil
    };
  }

  return {
    valid: true,
    daysUntil
  };
}

/**
 * F0294 + F0295: Validate booking time against both minimum and maximum notice
 */
export function validateBookingTime(
  startTime: string,
  config: {
    minimumNoticeHours?: number;
    maximumNoticeDays?: number;
  } = {}
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const minNotice = meetsMinimumNotice(
    startTime,
    config.minimumNoticeHours || 2
  );
  if (!minNotice.valid && minNotice.error) {
    errors.push(minNotice.error);
  }

  const maxNotice = meetsMaximumNotice(
    startTime,
    config.maximumNoticeDays || 90
  );
  if (!maxNotice.valid && maxNotice.error) {
    errors.push(maxNotice.error);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if booking is in the past
 */
export function isPastBooking(startTime: string): boolean {
  return new Date(startTime) < new Date();
}

/**
 * Check if booking is during business hours
 */
export function isDuringBusinessHours(
  startTime: string,
  businessHours: { start: string; end: string } = {
    start: '09:00',
    end: '17:00'
  }
): { valid: boolean; error?: string } {
  const start = new Date(startTime);
  const hours = start.getHours();
  const minutes = start.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const [startHour, startMinute] = businessHours.start.split(':').map(Number);
  const startTotalMinutes = startHour * 60 + startMinute;

  const [endHour, endMinute] = businessHours.end.split(':').map(Number);
  const endTotalMinutes = endHour * 60 + endMinute;

  if (totalMinutes < startTotalMinutes || totalMinutes >= endTotalMinutes) {
    return {
      valid: false,
      error: `Booking must be during business hours (${businessHours.start}-${businessHours.end})`
    };
  }

  return { valid: true };
}

/**
 * F0324: Validate booking respects event type buffer settings
 * Checks if the requested time has proper buffer before/after based on event type config
 */
export function validateBufferTime(
  startTime: string,
  eventLength: number,
  bufferConfig: {
    beforeEventBuffer?: number; // minutes
    afterEventBuffer?: number; // minutes
  },
  existingBookings: Array<{ startTime: string; endTime: string }> = []
): { valid: boolean; error?: string } {
  const requestedStart = new Date(startTime);
  const requestedEnd = new Date(requestedStart.getTime() + eventLength * 60000);

  const beforeBuffer = bufferConfig.beforeEventBuffer || 0;
  const afterBuffer = bufferConfig.afterEventBuffer || 0;

  // Required buffer window
  const bufferStart = new Date(requestedStart.getTime() - beforeBuffer * 60000);
  const bufferEnd = new Date(requestedEnd.getTime() + afterBuffer * 60000);

  // Check if any existing booking conflicts with buffer window
  for (const booking of existingBookings) {
    const bookingStart = new Date(booking.startTime);
    const bookingEnd = new Date(booking.endTime);

    // Check if buffer window overlaps with any booking
    const hasOverlap =
      (bufferStart >= bookingStart && bufferStart < bookingEnd) ||
      (bufferEnd > bookingStart && bufferEnd <= bookingEnd) ||
      (bufferStart <= bookingStart && bufferEnd >= bookingEnd);

    if (hasOverlap) {
      const bufferMinutes = beforeBuffer + afterBuffer;
      return {
        valid: false,
        error: `Booking requires ${bufferMinutes} minutes of buffer time (${beforeBuffer} before, ${afterBuffer} after) which conflicts with an existing booking`
      };
    }
  }

  return { valid: true };
}
