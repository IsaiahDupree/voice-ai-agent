// F0144: After-hours voicemail routing
// F0109: Business hours check

export interface BusinessHours {
  timezone: string
  hours: {
    monday?: { start: string; end: string }
    tuesday?: { start: string; end: string }
    wednesday?: { start: string; end: string }
    thursday?: { start: string; end: string }
    friday?: { start: string; end: string }
    saturday?: { start: string; end: string }
    sunday?: { start: string; end: string }
  }
  holidays?: string[] // Array of dates in YYYY-MM-DD format
}

export const defaultBusinessHours: BusinessHours = {
  timezone: 'America/New_York',
  hours: {
    monday: { start: '09:00', end: '17:00' },
    tuesday: { start: '09:00', end: '17:00' },
    wednesday: { start: '09:00', end: '17:00' },
    thursday: { start: '09:00', end: '17:00' },
    friday: { start: '09:00', end: '17:00' },
  },
  holidays: [],
}

/**
 * F0144: Check if current time is within business hours
 * Returns true if within business hours, false if after hours (should route to voicemail)
 */
export function isWithinBusinessHours(config: BusinessHours = defaultBusinessHours): boolean {
  const now = new Date()
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const currentDay = dayNames[now.getDay()]

  // F0110: Check if today is a holiday
  const today = now.toISOString().split('T')[0]
  if (config.holidays?.includes(today)) {
    return false // It's a holiday - route to voicemail
  }

  // Check if business hours are defined for this day
  const dayHours = config.hours[currentDay as keyof typeof config.hours]
  if (!dayHours) {
    return false // No hours configured for this day - closed
  }

  // Parse current time in HH:MM format
  const currentTime = now.toTimeString().substring(0, 5) // "HH:MM"

  // Check if current time is within start and end
  return currentTime >= dayHours.start && currentTime < dayHours.end
}

/**
 * Get a human-readable message for when the business is closed
 */
export function getAfterHoursMessage(config: BusinessHours = defaultBusinessHours): string {
  const now = new Date()
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  // Find next business day
  for (let i = 1; i <= 7; i++) {
    const nextDay = new Date(now)
    nextDay.setDate(nextDay.getDate() + i)
    const nextDayName = dayNames[nextDay.getDay()]
    const nextDayHours = config.hours[nextDayName as keyof typeof config.hours]

    if (nextDayHours) {
      const dayLabel = i === 1 ? 'tomorrow' : nextDayName.charAt(0).toUpperCase() + nextDayName.slice(1)
      return `We're currently closed. Our business hours are ${nextDayHours.start} to ${nextDayHours.end}. We'll be back ${dayLabel}. Please leave a message.`
    }
  }

  return "We're currently closed. Please leave a message and we'll get back to you soon."
}
