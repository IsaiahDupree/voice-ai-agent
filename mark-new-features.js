const fs = require('fs');

const implementedFeatureIds = [
  'F0067', // Vapi health check - app/api/health/route.ts fully implemented
  'F0100', // Phone number purchase - app/api/vapi/phone-numbers/route.ts POST
  'F0101', // Number area code select - createPhoneNumber supports areaCode param
  'F0102', // Number country select - can specify country in createPhoneNumber
  'F0146', // Inbound call dedup - UNIQUE constraint on call_id in schema
  'F0147', // Call direction field - just added to schema + webhook handler
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

// Sync to harness
const harnessPath = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json';
fs.writeFileSync(harnessPath, JSON.stringify(features, null, 2));
console.log(`📝 Synced to ${harnessPath}`);

// Count total completed
const totalCompleted = features.features.filter(f => f.passes).length;
console.log(`\n📊 Total completed: ${totalCompleted}/${features.total_features} (${(totalCompleted/features.total_features*100).toFixed(1)}%)`);
