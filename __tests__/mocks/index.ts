// Test mocks index
// F1241-F1244: Centralized mock clients for testing

export * from './supabase-mock'
export * from './vapi-mock'
export * from './twilio-mock'
export * from './calcom-mock'

// Re-export with categorized names for convenience
import { mockSupabase } from './supabase-mock'
import { mockVapi } from './vapi-mock'
import { mockTwilio } from './twilio-mock'
import { mockCalcom } from './calcom-mock'

export const mocks = {
  supabase: mockSupabase,
  vapi: mockVapi,
  twilio: mockTwilio,
  calcom: mockCalcom,
}

/**
 * Reset all mocks to initial state
 */
export function resetAllMocks() {
  mockSupabase.reset()
  mockVapi.reset()
  mockTwilio.reset()
  mockCalcom.reset()
}

export default mocks
