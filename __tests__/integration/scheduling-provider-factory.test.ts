/**
 * Feature 224: Integration Test - SchedulingProvider Factory
 * Verifies that getSchedulingProvider() switches providers based on SCHEDULING_PROVIDER env var
 *
 * @jest-environment node
 */

import {
  getSchedulingProvider,
  createSchedulingProvider,
  validateSchedulingConfig,
  CalComProvider,
  EasyAppointmentsProvider,
  GoogleCalendarProvider,
} from '@/lib/scheduling'

describe('SchedulingProvider Factory - Environment Variable Switching', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset env vars before each test
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('should return CalComProvider when SCHEDULING_PROVIDER=calcom', () => {
    process.env.SCHEDULING_PROVIDER = 'calcom'
    process.env.CALCOM_API_KEY = 'test-calcom-key'
    process.env.CALCOM_API_URL = 'https://api.cal.com/v1'

    const provider = getSchedulingProvider()

    expect(provider).toBeInstanceOf(CalComProvider)
    expect(provider.name).toBe('calcom')

    console.log('✓ Factory returned CalComProvider for SCHEDULING_PROVIDER=calcom')
  })

  it('should return EasyAppointmentsProvider when SCHEDULING_PROVIDER=easyappointments', () => {
    process.env.SCHEDULING_PROVIDER = 'easyappointments'
    process.env.EASYAPPOINTMENTS_API_URL = 'http://localhost:8080'
    process.env.EASYAPPOINTMENTS_API_KEY = 'test-ea-key'
    process.env.EASYAPPOINTMENTS_SERVICE_ID = '1'

    const provider = getSchedulingProvider()

    expect(provider).toBeInstanceOf(EasyAppointmentsProvider)
    expect(provider.name).toBe('easyappointments')

    console.log('✓ Factory returned EasyAppointmentsProvider for SCHEDULING_PROVIDER=easyappointments')
  })

  it('should return GoogleCalendarProvider when SCHEDULING_PROVIDER=google-calendar', () => {
    process.env.SCHEDULING_PROVIDER = 'google-calendar'
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
    process.env.GOOGLE_REFRESH_TOKEN = 'test-refresh-token'
    process.env.GOOGLE_CALENDAR_ID = 'primary'

    const provider = getSchedulingProvider()

    expect(provider).toBeInstanceOf(GoogleCalendarProvider)
    expect(provider.name).toBe('google-calendar')

    console.log('✓ Factory returned GoogleCalendarProvider for SCHEDULING_PROVIDER=google-calendar')
  })

  it('should default to CalComProvider when SCHEDULING_PROVIDER is not set', () => {
    delete process.env.SCHEDULING_PROVIDER
    process.env.CALCOM_API_KEY = 'test-key'

    const provider = getSchedulingProvider()

    expect(provider).toBeInstanceOf(CalComProvider)
    expect(provider.name).toBe('calcom')

    console.log('✓ Factory defaulted to CalComProvider when SCHEDULING_PROVIDER not set')
  })

  it('should fallback to CalComProvider for unknown provider type', () => {
    process.env.SCHEDULING_PROVIDER = 'unknown-provider'
    process.env.CALCOM_API_KEY = 'fallback-key'

    const provider = getSchedulingProvider()

    expect(provider).toBeInstanceOf(CalComProvider)
    expect(provider.name).toBe('calcom')

    console.log('✓ Factory fell back to CalComProvider for unknown provider')
  })

  it('should be case-insensitive for provider names', () => {
    process.env.SCHEDULING_PROVIDER = 'CALCOM'
    process.env.CALCOM_API_KEY = 'test-key'

    const provider1 = getSchedulingProvider()
    expect(provider1).toBeInstanceOf(CalComProvider)

    process.env.SCHEDULING_PROVIDER = 'EasyAppointments'
    process.env.EASYAPPOINTMENTS_API_URL = 'http://localhost:8080'
    process.env.EASYAPPOINTMENTS_API_KEY = 'test-key'

    const provider2 = getSchedulingProvider()
    expect(provider2).toBeInstanceOf(EasyAppointmentsProvider)

    console.log('✓ Factory handles case-insensitive provider names')
  })

  it('should create provider with custom config using createSchedulingProvider', () => {
    const customConfig = {
      provider: 'easyappointments' as const,
      apiUrl: 'http://custom:8080',
      apiKey: 'custom-key',
      serviceId: '5',
    }

    const provider = createSchedulingProvider(customConfig)

    expect(provider).toBeInstanceOf(EasyAppointmentsProvider)
    expect(provider.name).toBe('easyappointments')

    console.log('✓ createSchedulingProvider created provider with custom config')
  })

  it('should throw error for unsupported provider in createSchedulingProvider', () => {
    const invalidConfig = {
      provider: 'invalid-provider' as any,
      apiKey: 'key',
      apiUrl: 'url',
    }

    expect(() => {
      createSchedulingProvider(invalidConfig)
    }).toThrow('Unsupported scheduling provider: invalid-provider')

    console.log('✓ createSchedulingProvider throws error for unsupported provider')
  })

  it('should validate Cal.com configuration', () => {
    process.env.SCHEDULING_PROVIDER = 'calcom'
    delete process.env.CALCOM_API_KEY

    const result = validateSchedulingConfig()

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('CALCOM_API_KEY')

    console.log(`✓ Validation failed for missing Cal.com config: ${result.errors[0]}`)
  })

  it('should validate Easy!Appointments configuration', () => {
    process.env.SCHEDULING_PROVIDER = 'easyappointments'
    delete process.env.EASYAPPOINTMENTS_API_URL
    delete process.env.EASYAPPOINTMENTS_API_KEY

    const result = validateSchedulingConfig()

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
    expect(result.errors.some((e) => e.includes('EASYAPPOINTMENTS_API_URL'))).toBe(true)
    expect(result.errors.some((e) => e.includes('EASYAPPOINTMENTS_API_KEY'))).toBe(true)

    console.log(`✓ Validation failed for missing Easy!Appointments config: ${result.errors.join(', ')}`)
  })

  it('should validate Google Calendar configuration', () => {
    process.env.SCHEDULING_PROVIDER = 'google-calendar'
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.GOOGLE_REFRESH_TOKEN

    const result = validateSchedulingConfig()

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(3)
    expect(result.errors.some((e) => e.includes('GOOGLE_CLIENT_ID'))).toBe(true)
    expect(result.errors.some((e) => e.includes('GOOGLE_CLIENT_SECRET'))).toBe(true)
    expect(result.errors.some((e) => e.includes('GOOGLE_REFRESH_TOKEN'))).toBe(true)

    console.log(`✓ Validation failed for missing Google Calendar config: ${result.errors.join(', ')}`)
  })

  it('should pass validation when all required env vars are set', () => {
    process.env.SCHEDULING_PROVIDER = 'calcom'
    process.env.CALCOM_API_KEY = 'valid-key'

    const result = validateSchedulingConfig()

    expect(result.valid).toBe(true)
    expect(result.errors.length).toBe(0)

    console.log('✓ Validation passed for complete Cal.com config')
  })

  it('should allow switching providers at runtime', () => {
    // Start with Cal.com
    process.env.SCHEDULING_PROVIDER = 'calcom'
    process.env.CALCOM_API_KEY = 'test-key'
    const provider1 = getSchedulingProvider()
    expect(provider1).toBeInstanceOf(CalComProvider)

    // Switch to Easy!Appointments
    process.env.SCHEDULING_PROVIDER = 'easyappointments'
    process.env.EASYAPPOINTMENTS_API_URL = 'http://localhost:8080'
    process.env.EASYAPPOINTMENTS_API_KEY = 'test-key'
    const provider2 = getSchedulingProvider()
    expect(provider2).toBeInstanceOf(EasyAppointmentsProvider)

    // Switch to Google Calendar
    process.env.SCHEDULING_PROVIDER = 'google-calendar'
    process.env.GOOGLE_CLIENT_ID = 'client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'secret'
    process.env.GOOGLE_REFRESH_TOKEN = 'token'
    const provider3 = getSchedulingProvider()
    expect(provider3).toBeInstanceOf(GoogleCalendarProvider)

    console.log('✓ Successfully switched between all three providers at runtime')
  })
})
