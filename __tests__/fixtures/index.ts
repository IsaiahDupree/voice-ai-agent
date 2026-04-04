// Test fixtures index
// F1232-F1237: Centralized test fixtures for all webhook events

export * from './vapi-events'
export * from './twilio-events'
export * from './calcom-events'

// Re-export with categorized names for convenience
import * as VapiFixtures from './vapi-events'
import * as TwilioFixtures from './twilio-events'
import * as CalcomFixtures from './calcom-events'

export const fixtures = {
  vapi: VapiFixtures,
  twilio: TwilioFixtures,
  calcom: CalcomFixtures,
}

export default fixtures
