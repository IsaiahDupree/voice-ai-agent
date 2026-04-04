// F0304-F0316: Calendar agent conversational helpers
// Functions to support natural booking flow in voice calls

import { calcomClient } from './calcom';

/**
 * F0312: Timezone detection from phone area code
 * Detects caller timezone based on phone number area code
 */
export function detectTimezoneFromPhone(phone: string): string {
  // Remove country code and formatting
  const cleaned = phone.replace(/^\+1/, '').replace(/\D/g, '');
  const areaCode = cleaned.substring(0, 3);

  // US timezone mapping by area code (simplified - expand as needed)
  const easternCodes = [
    '201', '202', '203', '212', '215', '216', '301', '302', '305',
    '401', '404', '407', '410', '412', '413', '508', '516', '518',
    '607', '617', '703', '704', '718', '757', '802', '914', '917', '919'
  ];

  const centralCodes = [
    '205', '214', '217', '256', '281', '312', '314', '316', '318',
    '319', '402', '405', '409', '501', '504', '507', '512', '608',
    '612', '615', '618', '630', '708', '713', '715', '817', '901',
    '903', '913', '918', '920'
  ];

  const mountainCodes = [
    '303', '307', '385', '406', '435', '480', '505', '520', '602',
    '623', '702', '719', '720', '801', '928'
  ];

  const pacificCodes = [
    '206', '209', '213', '253', '310', '323', '360', '408', '415',
    '425', '503', '510', '530', '541', '559', '562', '619', '626',
    '650', '661', '707', '714', '760', '805', '818', '831', '858',
    '909', '916', '925', '949', '951'
  ];

  if (easternCodes.includes(areaCode)) return 'America/New_York';
  if (centralCodes.includes(areaCode)) return 'America/Chicago';
  if (mountainCodes.includes(areaCode)) return 'America/Denver';
  if (pacificCodes.includes(areaCode)) return 'America/Los_Angeles';

  // Default to Eastern if unknown
  return 'America/New_York';
}

/**
 * F0305: Get event types for selection
 * Returns formatted list of available meeting durations
 */
export async function getEventTypeOptions(): Promise<
  Array<{ id: number; title: string; duration: number }>
> {
  try {
    const eventTypes = await calcomClient.getEventTypes();

    return eventTypes.map((et) => ({
      id: et.id,
      title: et.title,
      duration: et.length
    }));
  } catch (error) {
    console.error('[Calendar Agent] Error fetching event types:', error);
    return [];
  }
}

/**
 * F0304: Select event type by duration preference
 * Agent asks: "Would you prefer a 15, 30, or 60 minute call?"
 */
export async function selectEventTypeByDuration(
  preferredDuration: number
): Promise<number | null> {
  const eventTypes = await getEventTypeOptions();

  // Find exact match first
  const exact = eventTypes.find((et) => et.duration === preferredDuration);
  if (exact) return exact.id;

  // Find closest match
  if (eventTypes.length > 0) {
    const closest = eventTypes.reduce((prev, curr) =>
      Math.abs(curr.duration - preferredDuration) <
      Math.abs(prev.duration - preferredDuration)
        ? curr
        : prev
    );
    return closest.id;
  }

  return null;
}

/**
 * F0313: Offer limited slot options
 * Agent offers max 3 available slots to avoid overwhelming caller
 */
export async function getTopSlots(
  eventTypeId: number,
  date: string,
  timezone: string,
  maxSlots: number = 3
): Promise<string[]> {
  try {
    const slots = await calcomClient.getAvailability(eventTypeId, date);

    // Convert to caller's timezone and format
    return slots
      .slice(0, maxSlots)
      .map((slot) => {
        const time = new Date(slot.time);
        return time.toLocaleString('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      });
  } catch (error) {
    console.error('[Calendar Agent] Error fetching slots:', error);
    return [];
  }
}

/**
 * F0314: Capture preferred time before checking availability
 * Agent asks: "What time works best for you?"
 * Returns structured time preference
 */
export interface TimePreference {
  preferredDate?: string; // F0315: Day preference
  preferredTime?: string; // Specific time (e.g., "2pm", "10:30am")
  timeOfDay?: 'morning' | 'afternoon' | 'evening'; // F0316: Morning/afternoon
  dayOfWeek?: string; // F0315: Specific day (e.g., "Monday", "Wednesday")
}

/**
 * F0315: Parse day preference from natural language
 * Examples: "Monday", "next Tuesday", "this Friday"
 */
export function parseDayPreference(input: string): string | null {
  const lower = input.toLowerCase();
  const days = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
  ];

  // Check for specific day mentions
  for (const day of days) {
    if (lower.includes(day)) {
      return day;
    }
  }

  // Check for relative references
  if (lower.includes('today')) return 'today';
  if (lower.includes('tomorrow')) return 'tomorrow';
  if (lower.includes('next week')) return 'next_week';

  return null;
}

/**
 * F0316: Parse morning/afternoon preference
 * Examples: "morning", "afternoon", "evening", "early morning"
 */
export function parseTimeOfDayPreference(
  input: string
): 'morning' | 'afternoon' | 'evening' | null {
  const lower = input.toLowerCase();

  if (lower.includes('morning') || lower.includes('am')) return 'morning';
  if (lower.includes('afternoon') || lower.includes('pm')) return 'afternoon';
  if (lower.includes('evening') || lower.includes('night')) return 'evening';

  return null;
}

/**
 * F0314 + F0315 + F0316: Parse full time preference from natural language
 * Combines day, time of day, and specific time preferences
 */
export function parseTimePreference(input: string): TimePreference {
  return {
    dayOfWeek: parseDayPreference(input) ?? undefined,
    timeOfDay: parseTimeOfDayPreference(input) ?? undefined,
    preferredTime: input // Store raw input for reference
  };
}

/**
 * Find slots matching time preference
 * F0314/F0315/F0316: Filter slots based on expressed preferences
 */
export async function findSlotsMatchingPreference(
  eventTypeId: number,
  preference: TimePreference,
  timezone: string
): Promise<string[]> {
  try {
    // Get 7-day availability window
    const slotsByDate = await calcomClient.getAvailabilityWindow(
      eventTypeId,
      timezone
    );

    let matchingSlots: string[] = [];

    // Filter by time of day preference if specified
    for (const [date, slots] of Object.entries(slotsByDate)) {
      for (const slot of slots) {
        const slotTime = new Date(slot.time);
        const hour = slotTime.getHours();

        // Check time of day preference
        if (preference.timeOfDay) {
          if (preference.timeOfDay === 'morning' && (hour < 9 || hour >= 12))
            continue;
          if (
            preference.timeOfDay === 'afternoon' &&
            (hour < 12 || hour >= 17)
          )
            continue;
          if (preference.timeOfDay === 'evening' && hour < 17) continue;
        }

        matchingSlots.push(slot.time);
      }
    }

    // Return top 3 matches (F0313)
    return matchingSlots.slice(0, 3);
  } catch (error) {
    console.error('[Calendar Agent] Error finding matching slots:', error);
    return [];
  }
}
