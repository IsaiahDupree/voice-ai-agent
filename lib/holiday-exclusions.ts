// F0326: Holiday exclusions - exclude holiday dates from availability

export interface Holiday {
  date: string // YYYY-MM-DD
  name: string
  recurring?: boolean // If true, holiday recurs annually
}

// US Federal Holidays (recurring)
export const US_FEDERAL_HOLIDAYS: Holiday[] = [
  { date: '01-01', name: "New Year's Day", recurring: true },
  { date: '07-04', name: 'Independence Day', recurring: true },
  { date: '12-25', name: 'Christmas Day', recurring: true },
  { date: '11-11', name: 'Veterans Day', recurring: true },
  // Note: Some holidays like Thanksgiving are date-calculated and would need special logic
]

// 2026 specific holidays (non-recurring)
export const HOLIDAYS_2026: Holiday[] = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-01-19', name: 'Martin Luther King Jr. Day' },
  { date: '2026-02-16', name: "Presidents' Day" },
  { date: '2026-05-25', name: 'Memorial Day' },
  { date: '2026-07-03', name: 'Independence Day (Observed)' },
  { date: '2026-09-07', name: 'Labor Day' },
  { date: '2026-10-12', name: 'Columbus Day' },
  { date: '2026-11-11', name: 'Veterans Day' },
  { date: '2026-11-26', name: 'Thanksgiving' },
  { date: '2026-12-25', name: 'Christmas Day' },
]

/**
 * F0326: Check if a date is a holiday
 */
export function isHoliday(
  date: Date | string,
  customHolidays: Holiday[] = []
): { isHoliday: boolean; holidayName?: string } {
  const checkDate = typeof date === 'string' ? new Date(date) : date
  const dateStr = checkDate.toISOString().split('T')[0] // YYYY-MM-DD
  const monthDay = dateStr.substring(5) // MM-DD

  // Check 2026 specific holidays
  const specificHoliday = HOLIDAYS_2026.find(h => h.date === dateStr)
  if (specificHoliday) {
    return { isHoliday: true, holidayName: specificHoliday.name }
  }

  // Check recurring holidays
  const recurringHoliday = US_FEDERAL_HOLIDAYS.find(
    h => h.recurring && h.date === monthDay
  )
  if (recurringHoliday) {
    return { isHoliday: true, holidayName: recurringHoliday.name }
  }

  // Check custom holidays
  const customHoliday = customHolidays.find(
    h => h.date === dateStr || (h.recurring && h.date === monthDay)
  )
  if (customHoliday) {
    return { isHoliday: true, holidayName: customHoliday.name }
  }

  return { isHoliday: false }
}

/**
 * F0326: Filter out holidays from a list of available time slots
 */
export function excludeHolidays(
  slots: Array<{ time: string }>,
  customHolidays: Holiday[] = []
): Array<{ time: string }> {
  return slots.filter(slot => {
    const slotDate = new Date(slot.time)
    const holidayCheck = isHoliday(slotDate, customHolidays)
    return !holidayCheck.isHoliday
  })
}

/**
 * F0326: Validate booking is not on a holiday
 */
export function validateNotHoliday(
  startTime: string,
  customHolidays: Holiday[] = []
): { valid: boolean; error?: string } {
  const holidayCheck = isHoliday(startTime, customHolidays)

  if (holidayCheck.isHoliday) {
    return {
      valid: false,
      error: `Cannot book on ${holidayCheck.holidayName}. Please select a different date.`
    }
  }

  return { valid: true }
}
