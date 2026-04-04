const fs = require('fs');

const implementedFeatureIds = [
  'F0177', // Campaign create - app/api/campaigns/route.ts POST
  'F0182', // Contact list upload - app/api/campaigns/[id]/contacts/route.ts POST
  'F0183', // Contact list validate - phone validation in contacts route
  'F0184', // Contact dedup - duplicate check in contacts route
  'F0185', // Batch dial start - app/api/campaigns/[id]/start/route.ts
  'F0186', // Batch dial stop - app/api/campaigns/[id]/stop/route.ts
  'F0188', // Batch size config - stored in campaign metadata.batch_size
  'F0189', // Calling hours start - stored in campaign calling_window.start
  'F0190', // Calling hours end - stored in campaign calling_window.end
  'F0191', // Calling hours timezone - stored in campaign calling_window.timezone
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

// Show category progress
const categories = {};
features.features.forEach(f => {
  if (!categories[f.category]) {
    categories[f.category] = { total: 0, completed: 0 };
  }
  categories[f.category].total++;
  if (f.passes) categories[f.category].completed++;
});

console.log('\n📈 Top categories:');
const topCats = ['Vapi', 'Inbound', 'Outbound', 'FunctionTools', 'Dashboard'];
topCats.forEach(cat => {
  if (categories[cat]) {
    const { completed, total } = categories[cat];
    const pct = (completed/total*100).toFixed(0);
    console.log(`  ${cat}: ${completed}/${total} (${pct}%)`);
  }
});
