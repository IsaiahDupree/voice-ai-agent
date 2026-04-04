const fs = require('fs');

const implementedFeatureIds = [
  'F0144', // After-hours voicemail - lib/business-hours.ts fully implemented
  'F0148', // Answer rate metric - app/api/analytics/inbound/route.ts
  'F0160', // Inbound API test - app/api/test/inbound-call/route.ts
  'F0162', // Post-call summary - added to webhook handleCallEnded
  'F0163', // Call reason classification - added to webhook handleCallEnded
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
