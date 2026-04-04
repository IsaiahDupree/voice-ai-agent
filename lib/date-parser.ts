// F0403: Parse natural language date to ISO8601

/**
 * Parse natural language date strings to ISO8601 format (YYYY-MM-DD)
 * Supports:
 * - "today", "tomorrow", "yesterday"
 * - "next Monday", "next Friday"
 * - "this Monday", "this Friday"
 * - ISO dates: "2026-03-27"
 * - US dates: "03/27/2026", "3/27/26"
 */
export function parseNaturalDate(input: string, timezone: string = 'America/New_York'): string {
  const normalized = input.toLowerCase().trim()
  const today = new Date()

  // Handle "today"
  if (normalized === 'today') {
    return today.toISOString().split('T')[0]
  }

  // Handle "tomorrow"
  if (normalized === 'tomorrow') {
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  // Handle "yesterday"
  if (normalized === 'yesterday') {
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    return yesterday.toISOString().split('T')[0]
  }

  // Handle "next Monday", "next Friday", etc.
  const nextDayMatch = normalized.match(/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)
  if (nextDayMatch) {
    const targetDay = nextDayMatch[1]
    const date = getNextDayOfWeek(targetDay, today, true)
    return date.toISOString().split('T')[0]
  }

  // Handle "this Monday", "this Friday", etc.
  const thisDayMatch = normalized.match(/^this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)
  if (thisDayMatch) {
    const targetDay = thisDayMatch[1]
    const date = getNextDayOfWeek(targetDay, today, false)
    return date.toISOString().split('T')[0]
  }

  // Handle "in N days"
  const inDaysMatch = normalized.match(/^in\s+(\d+)\s+days?/)
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1])
    const futureDate = new Date(today)
    futureDate.setDate(today.getDate() + days)
    return futureDate.toISOString().split('T')[0]
  }

  // Try to parse as ISO date (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized
  }

  // Try to parse US format (MM/DD/YYYY or M/D/YY)
  const usDateMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (usDateMatch) {
    let month = usDateMatch[1].padStart(2, '0')
    let day = usDateMatch[2].padStart(2, '0')
    let year = usDateMatch[3]

    // Handle 2-digit year
    if (year.length === 2) {
      year = '20' + year
    }

    return `${year}-${month}-${day}`
  }

  // If we can't parse it, throw an error
  throw new Error(`Unable to parse date: "${input}". Please use YYYY-MM-DD format or natural language like "tomorrow" or "next Monday".`)
}

/**
 * Get the next occurrence of a specific day of week
 */
function getNextDayOfWeek(dayName: string, from: Date, nextWeek: boolean): Date {
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const targetDayIndex = daysOfWeek.indexOf(dayName.toLowerCase())

  if (targetDayIndex === -1) {
    throw new Error(`Invalid day name: ${dayName}`)
  }

  const currentDayIndex = from.getDay()
  let daysUntilTarget = targetDayIndex - currentDayIndex

  // If requesting "next Monday" and today is Monday, go to next week
  if (nextWeek && daysUntilTarget <= 0) {
    daysUntilTarget += 7
  }

  // If requesting "this Monday" and today is Monday, return today
  if (!nextWeek && daysUntilTarget < 0) {
    daysUntilTarget += 7
  }

  const result = new Date(from)
  result.setDate(from.getDate() + daysUntilTarget)
  return result
}

/**
 * Parse time string to HH:MM format (24-hour)
 * Supports:
 * - "9am", "9:30am", "9:30 AM"
 * - "14:00", "2:00pm"
 * - "noon", "midnight"
 */
export function parseNaturalTime(input: string): string {
  const normalized = input.toLowerCase().trim()

  // Handle special cases
  if (normalized === 'noon' || normalized === '12pm') {
    return '12:00'
  }
  if (normalized === 'midnight' || normalized === '12am') {
    return '00:00'
  }

  // Parse time with optional am/pm
  const timeMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1])
    const minutes = timeMatch[2] ? timeMatch[2] : '00'
    const meridiem = timeMatch[3]

    if (meridiem === 'pm' && hours < 12) {
      hours += 12
    } else if (meridiem === 'am' && hours === 12) {
      hours = 0
    }

    return `${hours.toString().padStart(2, '0')}:${minutes}`
  }

  throw new Error(`Unable to parse time: "${input}". Please use format like "9:30am" or "14:00".`)
}
