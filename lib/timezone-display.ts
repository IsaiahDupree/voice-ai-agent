// F0328 & F0346: Multi-timezone display utilities

/**
 * F0328: Format a time in multiple timezones
 */
export function formatTimeInMultipleTimezones(
  dateTime: string | Date,
  timezones: string[]
): Array<{ timezone: string; formatted: string; offset: string }> {
  const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;

  return timezones.map((timezone) => {
    try {
      const formatted = date.toLocaleString('en-US', {
        timeZone: timezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      });

      // Get timezone offset
      const offset = getTimezoneOffset(date, timezone);

      return {
        timezone,
        formatted,
        offset,
      };
    } catch (error) {
      console.error(`Error formatting time in timezone ${timezone}:`, error);
      return {
        timezone,
        formatted: 'Invalid timezone',
        offset: 'Unknown',
      };
    }
  });
}

/**
 * Get timezone offset in format like "UTC-5" or "UTC+3:30"
 */
export function getTimezoneOffset(date: Date, timezone: string): string {
  try {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));

    const offsetMs = tzDate.getTime() - utcDate.getTime();
    const offsetHours = Math.floor(Math.abs(offsetMs) / (1000 * 60 * 60));
    const offsetMinutes = Math.floor((Math.abs(offsetMs) % (1000 * 60 * 60)) / (1000 * 60));

    const sign = offsetMs >= 0 ? '+' : '-';
    const offsetString = offsetMinutes > 0
      ? `UTC${sign}${offsetHours}:${offsetMinutes.toString().padStart(2, '0')}`
      : `UTC${sign}${offsetHours}`;

    return offsetString;
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * F0346: Display a time slot in multiple timezones for booking confirmation
 */
export interface SlotDisplay {
  startTime: string;
  endTime: string;
  timezones: Array<{
    timezone: string;
    label: string;
    startFormatted: string;
    endFormatted: string;
    date: string;
    timeRange: string;
  }>;
}

export function displaySlotInMultipleTimezones(
  startTime: string | Date,
  endTime: string | Date,
  timezones: string[] = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'UTC']
): SlotDisplay {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;

  const timezoneDisplays = timezones.map((tz) => {
    const startFormatted = start.toLocaleString('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const endFormatted = end.toLocaleString('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const date = start.toLocaleString('en-US', {
      timeZone: tz,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const tzAbbr = start.toLocaleString('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).split(' ').pop() || tz;

    return {
      timezone: tz,
      label: `${tz} (${tzAbbr})`,
      startFormatted,
      endFormatted,
      date,
      timeRange: `${startFormatted} - ${endFormatted}`,
    };
  });

  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    timezones: timezoneDisplays,
  };
}

/**
 * Common timezone list
 */
export const COMMON_TIMEZONES = [
  'America/New_York',      // ET
  'America/Chicago',       // CT
  'America/Denver',        // MT
  'America/Los_Angeles',   // PT
  'America/Phoenix',       // AZ (no DST)
  'America/Anchorage',     // AKT
  'Pacific/Honolulu',      // HT
  'Europe/London',         // GMT/BST
  'Europe/Paris',          // CET
  'Europe/Berlin',         // CET
  'Asia/Dubai',            // GST
  'Asia/Kolkata',          // IST
  'Asia/Singapore',        // SGT
  'Asia/Tokyo',            // JST
  'Australia/Sydney',      // AEST
  'UTC',                   // UTC
];
