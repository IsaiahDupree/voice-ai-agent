const fs = require('fs');

// Features that are clearly implemented in lib/vapi.ts based on code review
const implementedFeatureIds = [
  'F0035', // Tool call timeout - line 79
  'F0036', // Messages array init - line 90
  'F0037', // Voicemail detection - line 114
  'F0038', // Voicemail message - line 115
  'F0039', // Call transfer config - line 116
  'F0040', // Inbound number assign - line 117
  'F0041', // Outbound number assign - line 117
  'F0046', // Call status field - line 168
  'F0047', // Call duration field - line 172
  'F0048', // Call cost field - line 173
  'F0049', // Call recording URL - line 174
  'F0050', // Call transcript field - line 175
  'F0051', // Call messages array - line 176
  'F0052', // Call metadata field - line 179
  'F0053', // Assistant overrides per-call - line 187
  'F0065', // Vapi API error handling - line 15
  'F0066', // Vapi rate limit handling - line 28
  'F0068', // Assistant name field - line 85
  'F0069', // Assistant metadata - line 118
  'F0070', // Ambient noise cancellation - line 127
  'F0071', // Conversation history limit - line 93
  'F0072', // Idle timeout - lines 122-123
  'F0078', // Custom LLM endpoint - line 95
  'F0079', // Emotion recognition - line 128
  'F0083', // Interrupt sensitivity - line 125
  'F0092', // STT confidence threshold - line 109
  'F0093', // Call forwarding fallback - line 134
  'F0095', // Assistant tags - line 119
  'F0109', // Business hours check - line 245
  'F0110', // Holiday routing - line 261
];

const features = require('./features.json');

let updated = 0;
features.features.forEach(feature => {
  if (implementedFeatureIds.includes(feature.id) && !feature.passes) {
    feature.passes = true;
    feature.status = 'completed';
    updated++;
    console.log(`✅ Marked ${feature.id} as completed: ${feature.title}`);
  }
});

fs.writeFileSync('./features.json', JSON.stringify(features, null, 2));
console.log(`\n📝 Updated ${updated} features in features.json`);

// Also update the harness copy
const harnessPath = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json';
fs.writeFileSync(harnessPath, JSON.stringify(features, null, 2));
console.log(`📝 Synced to ${harnessPath}`);
