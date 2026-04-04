// F1220, F1221, F1222, F1223: Load test configuration
export const LOAD_TEST_CONFIG = {
  // F1220: Concurrent calls test
  concurrentCalls: {
    count: 10,
    assistantId: process.env.TEST_ASSISTANT_ID || 'test-assistant-id',
    phoneNumbers: Array.from({ length: 10 }, (_, i) => `+1555000${String(i).padStart(4, '0')}`),
  },

  // F1221: Webhook throughput test
  webhookThroughput: {
    eventsPerMinute: 100,
    duration: 60, // seconds
    webhookUrl: process.env.TEST_WEBHOOK_URL || 'http://localhost:3000/api/webhooks/vapi',
  },

  // F1222: SMS batch test
  smsBatch: {
    count: 50,
    message: 'Load test SMS',
    phoneNumbers: Array.from({ length: 50 }, (_, i) => `+1555100${String(i).padStart(4, '0')}`),
  },

  // F1223: API throughput test
  apiThroughput: {
    requestsPerSecond: 100,
    duration: 10, // seconds
    endpoints: [
      { method: 'GET', path: '/api/health' },
      { method: 'GET', path: '/api/calls' },
      { method: 'GET', path: '/api/contacts' },
    ],
  },
}
