/**
 * Feature 223: Integration Test - Easy!Appointments bookAppointment
 * Verifies that bookAppointment creates an appointment in Easy!Appointments
 *
 * @jest-environment node
 */

import { EasyAppointmentsProvider } from '@/lib/scheduling/easyappointments'

describe('Easy!Appointments - bookAppointment Integration', () => {
  const mockApiUrl = process.env.EASYAPPOINTMENTS_API_URL || 'http://localhost:8080'
  const mockApiKey = process.env.EASYAPPOINTMENTS_API_KEY || 'test-api-key'
  const mockServiceId = process.env.EASYAPPOINTMENTS_SERVICE_ID || '1'

  let provider: EasyAppointmentsProvider
  let createdBookingId: string | null = null

  beforeAll(() => {
    provider = new EasyAppointmentsProvider({
      apiUrl: mockApiUrl,
      apiKey: mockApiKey,
      serviceId: mockServiceId,
    })
  })

  afterAll(async () => {
    // Cleanup: cancel the test booking if it was created
    if (createdBookingId) {
      try {
        await provider.cancelAppointment({ booking_id: createdBookingId })
        console.log(`✓ Cleaned up test booking: ${createdBookingId}`)
      } catch (error) {
        console.error('Failed to clean up test booking:', error)
      }
    }
  })

  it('should create an appointment successfully', async () => {
    const startTime = new Date()
    startTime.setDate(startTime.getDate() + 3) // 3 days from now
    startTime.setHours(14, 0, 0, 0) // 2:00 PM

    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + 30)

    const testCustomer = {
      customer_name: 'Integration Test User',
      customer_email: 'integration-test@example.com',
      customer_phone: '+15555551234',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      timezone: 'America/New_York',
      notes: 'This is a test appointment created by automated integration test',
    }

    const result = await provider.bookAppointment(testCustomer)

    // Verify booking was successful
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.booking).toBeDefined()

    if (result.booking) {
      // Store booking ID for cleanup
      createdBookingId = result.booking.id

      // Verify booking details
      expect(result.booking.id).toBeDefined()
      expect(result.booking.provider).toBe('easyappointments')
      expect(result.booking.customer_name).toBe(testCustomer.customer_name)
      expect(result.booking.customer_email).toBe(testCustomer.customer_email)
      expect(result.booking.customer_phone).toBe(testCustomer.customer_phone)
      expect(result.booking.start_time).toBe(testCustomer.start_time)
      expect(result.booking.end_time).toBe(testCustomer.end_time)
      expect(result.booking.status).toBe('confirmed')
      expect(result.booking.created_at).toBeDefined()

      console.log(`✓ Created booking ID: ${result.booking.id}`)
      console.log(`✓ Customer: ${result.booking.customer_name}`)
      console.log(`✓ Time: ${result.booking.start_time}`)
    }
  })

  it('should fail to create appointment with missing customer email', async () => {
    const startTime = new Date()
    startTime.setDate(startTime.getDate() + 4)
    startTime.setHours(10, 0, 0, 0)

    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + 30)

    const result = await provider.bookAppointment({
      customer_name: 'Test User',
      customer_email: undefined, // Missing email
      customer_phone: '+15555555678',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      timezone: 'America/New_York',
    })

    // Should fail gracefully
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('email')

    console.log(`✓ Correctly rejected booking without email: ${result.error}`)
  })

  it('should fail to create appointment in the past', async () => {
    const pastTime = new Date()
    pastTime.setDate(pastTime.getDate() - 1) // Yesterday
    pastTime.setHours(14, 0, 0, 0)

    const endTime = new Date(pastTime)
    endTime.setMinutes(endTime.getMinutes() + 30)

    const result = await provider.bookAppointment({
      customer_name: 'Test User',
      customer_email: 'test@example.com',
      customer_phone: '+15555559999',
      start_time: pastTime.toISOString(),
      end_time: endTime.toISOString(),
      timezone: 'America/New_York',
    })

    // Should fail
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()

    console.log(`✓ Correctly rejected past appointment: ${result.error}`)
  })

  it('should handle concurrent bookings for the same slot', async () => {
    const startTime = new Date()
    startTime.setDate(startTime.getDate() + 5)
    startTime.setHours(15, 0, 0, 0)

    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + 30)

    const customer1 = {
      customer_name: 'Customer One',
      customer_email: 'customer1@example.com',
      customer_phone: '+15555551111',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      timezone: 'America/New_York',
    }

    const customer2 = {
      customer_name: 'Customer Two',
      customer_email: 'customer2@example.com',
      customer_phone: '+15555552222',
      start_time: startTime.toISOString(), // Same time
      end_time: endTime.toISOString(),
      timezone: 'America/New_York',
    }

    // Book first appointment
    const result1 = await provider.bookAppointment(customer1)
    expect(result1.success).toBe(true)

    if (result1.booking) {
      createdBookingId = result1.booking.id
    }

    // Attempt to book same slot (should fail or be automatically rescheduled)
    const result2 = await provider.bookAppointment(customer2)

    // Either fails gracefully or succeeds with different time
    if (result2.success) {
      // If it succeeds, verify it's a different slot or provider handles double-booking
      console.log('✓ Provider handled concurrent booking (may allow double-booking)')

      // Cleanup second booking if created
      if (result2.booking) {
        await provider.cancelAppointment({ booking_id: result2.booking.id })
      }
    } else {
      expect(result2.error).toBeDefined()
      console.log(`✓ Correctly rejected double booking: ${result2.error}`)
    }
  })

  it('should include notes in the booking', async () => {
    const startTime = new Date()
    startTime.setDate(startTime.getDate() + 6)
    startTime.setHours(11, 0, 0, 0)

    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + 30)

    const testNotes = 'Customer requested a follow-up consultation about product features.'

    const result = await provider.bookAppointment({
      customer_name: 'Notes Test User',
      customer_email: 'notes-test@example.com',
      customer_phone: '+15555553333',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      timezone: 'America/New_York',
      notes: testNotes,
    })

    expect(result.success).toBe(true)
    expect(result.booking?.notes).toBe(testNotes)

    if (result.booking) {
      // Cleanup
      await provider.cancelAppointment({ booking_id: result.booking.id })
      console.log(`✓ Notes correctly saved: "${testNotes}"`)
    }
  })

  it('should return booking details that can be retrieved later', async () => {
    const startTime = new Date()
    startTime.setDate(startTime.getDate() + 7)
    startTime.setHours(16, 0, 0, 0)

    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + 30)

    // Create booking
    const createResult = await provider.bookAppointment({
      customer_name: 'Retrieval Test User',
      customer_email: 'retrieval-test@example.com',
      customer_phone: '+15555554444',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      timezone: 'America/New_York',
    })

    expect(createResult.success).toBe(true)
    expect(createResult.booking).toBeDefined()

    if (createResult.booking) {
      const bookingId = createResult.booking.id

      // Retrieve booking
      const retrievedBooking = await provider.getBooking(bookingId)

      expect(retrievedBooking).not.toBeNull()
      expect(retrievedBooking?.id).toBe(bookingId)
      expect(retrievedBooking?.customer_email).toBe('retrieval-test@example.com')

      // Cleanup
      await provider.cancelAppointment({ booking_id: bookingId })
      console.log(`✓ Successfully created and retrieved booking ID: ${bookingId}`)
    }
  })
})
