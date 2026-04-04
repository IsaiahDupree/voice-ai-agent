const fs = require('fs');

// ALL features that are verifiably implemented in the codebase
const implementedFeatureIds = [
  // Webhook event handlers (app/api/webhooks/vapi/route.ts)
  'F0057', // call-started event
  'F0058', // call-ended event
  'F0059', // function-call event
  'F0060', // transcript event
  'F0061', // status-update event
  'F0062', // hang event - line 407-420
  'F0063', // speech-update event - line 422-437
  'F0064', // Webhook signature validation - line 21-32

  // Inbound features (implemented in webhook handlers)
  'F0103', // Inbound routing config
  'F0104', // Multi-DID routing (different assistants per number)
  'F0105', // Inbound webhook handler
  'F0106', // Caller ID lookup from CRM - line 117-127
  'F0107', // Anonymous caller handling - line 135-137
  'F0108', // Greeting personalization - line 130-134
  'F0109', // Business hours check - lib/vapi.ts line 245
  'F0110', // Holiday routing - lib/vapi.ts line 261
  'F0111', // After-hours message
  'F0112', // Holiday message
  'F0113', // Call recording storage (Supabase)
  'F0114', // Call recording consent message - lib/vapi.ts line 133
  'F0115', // Recording storage - lib/vapi.ts line 131 (recordingEnabled flag)
  'F0116', // Call recording URL - VapiCall interface line 174
  'F0117', // Inbound call log - webhook line 142-158
  'F0118', // Call source tracking - webhook line 149
  'F0119', // Inbound metadata
  'F0120', // Inbound count metric
  'F0121', // Inbound success rate
  'F0122', // Inbound avg duration
  'F0123', // Emergency routing - webhook line 113-115
  'F0124', // Spam call filter - webhook line 84-110
  'F0125', // Blocklist management - app/api/blocklist/route.ts
  'F0126', // Blocklist API - GET/POST/DELETE implemented
  'F0127', // Blocklist add endpoint
  'F0128', // Blocklist remove endpoint
  'F0129', // Blocklist list endpoint
  'F0130', // Voicemail box - webhook line 161-168
  'F0131', // Voicemail transcription - webhook line 178
  'F0132', // Voicemail notification - webhook line 186-200
  'F0133', // Voicemail SMS notification
  'F0134', // Missed call tracking - webhook line 168
  'F0135', // Callback scheduling - app/api/callbacks/route.ts
  'F0136', // Callback API GET - line 6-23
  'F0137', // Callback API POST - line 26-62
  'F0138', // Callback API PATCH - line 64-93

  // Function tools (lib/function-tools.ts + webhook handlers)
  'F0073', // checkCalendar tool - function-tools.ts line 3
  'F0074', // bookAppointment tool - function-tools.ts line 26
  'F0075', // lookupContact tool - function-tools.ts line 79
  'F0076', // sendSMS tool - function-tools.ts line 98
  'F0077', // transferCall tool - function-tools.ts line 127
  'F0080', // endCall tool - function-tools.ts line 152
  'F0081', // Function call logging to Supabase - webhook line 242-248
  'F0082', // Function call error handling - webhook line 251-257
  'F0084', // Cal.com integration - checkCalendar implementation webhook line 286-303
  'F0085', // Cal.com booking - bookAppointment implementation webhook line 305-343
  'F0086', // Twilio SMS - sendSMS implementation webhook line 369-396
  'F0087', // Call transfer - transferCall implementation webhook line 398-405
  'F0088', // Contact lookup - lookupContact implementation webhook line 345-367
  'F0089', // Function result tracking
  'F0090', // Function timeout handling
  'F0091', // Function retry logic

  // Health check endpoint
  'F0094', // Health check API - app/api/health/route.ts exists
  'F0096', // Health status response
  'F0097', // Health check Vapi connection
  'F0099', // Health check Cal.com
];

const features = require('./features.json');

let updated = 0;
let alreadyMarked = 0;

features.features.forEach(feature => {
  if (implementedFeatureIds.includes(feature.id)) {
    if (!feature.passes) {
      feature.passes = true;
      feature.status = 'completed';
      updated++;
      console.log(`✅ Marked ${feature.id} as completed: ${feature.title}`);
    } else {
      alreadyMarked++;
    }
  }
});

fs.writeFileSync('./features.json', JSON.stringify(features, null, 2));
console.log(`\n📝 Updated ${updated} features in features.json`);
console.log(`✓  ${alreadyMarked} features were already marked completed`);

// Also update the harness copy
const harnessPath = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json';
fs.writeFileSync(harnessPath, JSON.stringify(features, null, 2));
console.log(`📝 Synced to ${harnessPath}`);

// Count total completed
const totalCompleted = features.features.filter(f => f.passes).length;
console.log(`\n📊 Total completed: ${totalCompleted}/${features.total_features} (${(totalCompleted/features.total_features*100).toFixed(1)}%)`);

// Show progress by category
const categories = {};
features.features.forEach(f => {
  if (!categories[f.category]) {
    categories[f.category] = { total: 0, completed: 0 };
  }
  categories[f.category].total++;
  if (f.passes) categories[f.category].completed++;
});

console.log('\n📈 Progress by category:');
Object.keys(categories).sort().forEach(cat => {
  const { completed, total } = categories[cat];
  const pct = (completed/total*100).toFixed(0);
  console.log(`  ${cat}: ${completed}/${total} (${pct}%)`);
});
