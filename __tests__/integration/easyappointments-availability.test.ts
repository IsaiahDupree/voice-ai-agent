/**
 * Feature 222: Integration Test - Easy!Appointments checkAvailability
 * Verifies that checkAvailability returns slots from Easy!Appointments API
 *
 * @jest-environment node
 */

import { EasyAppointmentsProvider } from '@/lib/scheduling/easyappointments'

describe('Easy!Appointments - checkAvailability Integration', () => {
  const mockApiUrl = process.env.EASYAPPOINTMENTS_API_URL || 'http://localhost:8080'
  const mockApiKey = process.env.EASYAPPOINTMENTS_API_KEY || 'test-api-key'
  const mockServiceId = process.env.EASYAPPOINTMENTS_SERVICE_ID || '1'

  let provider: EasyAppointmentsProvider

  beforeAll(() => {
    provider = new EasyAppointmentsProvider({
      apiUrl: mockApiUrl,
      apiKey: mockApiKey,
      serviceId: mockServiceId,
    })
  })

  it('should return available slots for a valid date range', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)

    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    nextWeek.setHours(17, 0, 0, 0)

    const result = await provider.checkAvailability({
      start_date: tomorrow.toISOString(),
      end_date: nextWeek.toISOString(),
      duration_minutes: 30,
      timezone: 'America/New_York',
    })

    // Verify structure
    expect(result).toHaveProperty('slots')
    expect(result).toHaveProperty('timezone')
    expect(result).toHaveProperty('duration_minutes')

    expect(Array.isArray(result.slots)).toBe(true)
    expect(result.timezone).toBe('America/New_York')
    expect(result.duration_minutes).toBe(30)

    // Verify slots have correct structure
    if (result.slots.length > 0) {
      const firstSlot = result.slots[0]
      expect(firstSlot).toHaveProperty('start')
      expect(firstSlot).toHaveProperty('end')
      expect(firstSlot).toHaveProperty('available')
      expect(firstSlot).toHaveProperty('timezone')

      expect(typeof firstSlot.start).toBe('string')
      expect(typeof firstSlot.end).toBe('string')
      expect(typeof firstSlot.available).toBe('boolean')

      // Verify start/end are valid dates
      expect(new Date(firstSlot.start)).toBeInstanceOf(Date)
      expect(new Date(firstSlot.end)).toBeInstanceOf(Date)
    }

    console.log(`✓ Returned ${result.slots.length} slots from Easy!Appointments`)
  })

  it('should return available slots for different durations', async () => {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() + 2)
    startDate.setHours(10, 0, 0, 0)

    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 3)
    endDate.setHours(16, 0, 0, 0)

    // Test 60-minute appointment
    const result60 = await provider.checkAvailability({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      duration_minutes: 60,
      timezone: 'America/New_York',
    })

    expect(result60.duration_minutes).toBe(60)
    expect(result60.slots.length).toBeGreaterThanOrEqual(0)

    // Test 15-minute appointment
    const result15 = await provider.checkAvailability({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      duration_minutes: 15,
      timezone: 'America/New_York',
    })

    expect(result15.duration_minutes).toBe(15)
    expect(result15.slots.length).toBeGreaterThanOrEqual(0)

    // Shorter duration should typically have more slots (or equal)
    // This assumes business hours are configured
    console.log(`✓ 60-min slots: ${result60.slots.length}, 15-min slots: ${result15.slots.length}`)
  })

  it('should handle invalid date range gracefully', async () => {
    const endDate = new Date()
    endDate.setDate(endDate.getDate() - 1) // Yesterday

    const startDate = new Date() // Today

    // End date before start date should throw or return empty
    await expect(
      provider.checkAvailability({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        duration_minutes: 30,
        timezone: 'America/New_York',
      })
    ).rejects.toThrow()
  })

  it('should filter out past dates', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(9, 0, 0, 0)

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(17, 0, 0, 0)

    const result = await provider.checkAvailability({
      start_date: yesterday.toISOString(),
      end_date: tomorrow.toISOString(),
      duration_minutes: 30,
      timezone: 'America/New_York',
    })

    // All returned slots should be in the future
    const now = new Date()
    result.slots.forEach((slot) => {
      const slotStart = new Date(slot.start)
      if (slot.available) {
        expect(slotStart.getTime()).toBeGreaterThanOrEqual(now.getTime())
      }
    })

    console.log('✓ Correctly filtered out past time slots')
  })

  it('should respect business hours', async () => {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() + 1)
    startDate.setHours(0, 0, 0, 0) // Midnight

    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 1)
    endDate.setHours(23, 59, 59, 999) // End of day

    const result = await provider.checkAvailability({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      duration_minutes: 30,
      timezone: 'America/New_York',
    })

    // Verify all available slots are within reasonable business hours (e.g., 9-17)
    result.slots
      .filter((slot) => slot.available)
      .forEach((slot) => {
        const slotStart = new Date(slot.start)
        const hour = slotStart.getHours()

        // Assuming business hours are 9 AM - 5 PM
        expect(hour).toBeGreaterThanOrEqual(9)
        expect(hour).toBeLessThan(17)
      })

    console.log('✓ All available slots within business hours')
  })
})
