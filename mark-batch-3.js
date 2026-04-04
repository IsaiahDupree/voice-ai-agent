const fs = require('fs');

const implementedFeatureIds = [
  'F0098', // Call whisper - lib/call-whisper.ts fully implemented
  'F1400', // Vapi call labels - app/api/calls/[id]/labels/route.ts
  'F1401', // Vapi call notes - app/api/calls/[id]/notes/route.ts
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

// Vapi category progress
const vapiCompleted = features.features.filter(f => f.passes && f.category === 'Vapi').length;
const vapiTotal = features.features.filter(f => f.category === 'Vapi').length;
console.log(`🎯 Vapi category: ${vapiCompleted}/${vapiTotal} (${(vapiCompleted/vapiTotal*100).toFixed(0)}%)`);
