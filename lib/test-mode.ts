// F1185-F1188: Test mode configuration
// Provides test mode flags for all external services

/**
 * F1185: VAPI_TEST_MODE - disables real call initiation
 */
export const isVapiTestMode = (): boolean => {
  return process.env.VAPI_TEST_MODE === 'true'
}

/**
 * F1186: Twilio test mode - use test credentials
 * When enabled, uses Twilio test account SID/token to avoid charges
 */
export const isTwilioTestMode = (): boolean => {
  return process.env.TWILIO_TEST_MODE === 'true'
}

/**
 * F1187: CALCOM_SANDBOX - uses Cal.com sandbox API
 */
export const isCalcomSandbox = (): boolean => {
  return process.env.CALCOM_SANDBOX === 'true'
}

/**
 * F1188: Supabase test DB
 * Uses separate Supabase project for test environment
 */
export const isSupabaseTestMode = (): boolean => {
  return process.env.SUPABASE_TEST_MODE === 'true'
}

/**
 * Get Supabase URL based on test mode
 */
export const getSupabaseUrl = (): string => {
  if (isSupabaseTestMode() && process.env.SUPABASE_TEST_URL) {
    return process.env.SUPABASE_TEST_URL
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL || ''
}

/**
 * Get Supabase anon key based on test mode
 */
export const getSupabaseAnonKey = (): string => {
  if (isSupabaseTestMode() && process.env.SUPABASE_TEST_ANON_KEY) {
    return process.env.SUPABASE_TEST_ANON_KEY
  }
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}

/**
 * Get Supabase service role key based on test mode
 */
export const getSupabaseServiceKey = (): string => {
  if (isSupabaseTestMode() && process.env.SUPABASE_TEST_SERVICE_KEY) {
    return process.env.SUPABASE_TEST_SERVICE_KEY
  }
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

/**
 * Get Twilio credentials based on test mode
 */
export const getTwilioCredentials = () => {
  if (isTwilioTestMode()) {
    return {
      accountSid: process.env.TWILIO_TEST_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_TEST_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: process.env.TWILIO_TEST_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER || '',
      isTest: true,
    }
  }

  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    isTest: false,
  }
}

/**
 * Get Cal.com base URL based on sandbox mode
 */
export const getCalcomBaseUrl = (): string => {
  if (isCalcomSandbox() && process.env.CALCOM_SANDBOX_URL) {
    return process.env.CALCOM_SANDBOX_URL
  }
  return process.env.CALCOM_BASE_URL || 'https://api.cal.com/v1'
}

/**
 * Check if running in any test mode
 */
export const isTestMode = (): boolean => {
  return (
    isVapiTestMode() ||
    isTwilioTestMode() ||
    isCalcomSandbox() ||
    isSupabaseTestMode() ||
    process.env.NODE_ENV === 'test'
  )
}

/**
 * Get test mode summary for logging
 */
export const getTestModeSummary = () => {
  return {
    vapi: isVapiTestMode(),
    twilio: isTwilioTestMode(),
    calcom: isCalcomSandbox(),
    supabase: isSupabaseTestMode(),
    nodeEnv: process.env.NODE_ENV,
    isTestMode: isTestMode(),
  }
}
