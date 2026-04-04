const fs = require('fs');

// Call APIs and Phone Number APIs are all implemented
const implementedFeatureIds = [
  'F0042', // Start call API - app/api/calls/route.ts line 5
  'F0043', // End call API - app/api/calls/[id]/route.ts line 28
  'F0044', // Get call API - app/api/calls/[id]/route.ts line 5
  'F0045', // List calls API - app/api/calls/route.ts line 47
  'F0054', // Phone number create - app/api/vapi/phone-numbers/route.ts line 5
  'F0055', // Phone number list - app/api/vapi/phone-numbers/route.ts line 24
  'F0056', // Phone number delete - app/api/vapi/phone-numbers/[id]/route.ts line 5
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

// Count total completed
const totalCompleted = features.features.filter(f => f.passes).length;
console.log(`\n📊 Total completed: ${totalCompleted}/${features.total_features} (${(totalCompleted/features.total_features*100).toFixed(1)}%)`);
