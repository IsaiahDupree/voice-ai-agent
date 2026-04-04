const fs = require('fs');
const harnessPath = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json';
const data = JSON.parse(fs.readFileSync(harnessPath, 'utf8'));

// Count by passes
const byPasses = {};
data.features.forEach(f => {
  const key = String(f.passes);
  byPasses[key] = (byPasses[key] || 0) + 1;
});
console.log('By passes value:');
Object.entries(byPasses).forEach(([passes, count]) => {
  console.log(`  ${passes}: ${count}`);
});

// Check features that are NOT passes:true
const notPassing = data.features.filter(f => f.passes !== true);
console.log('\nFeatures not passing:', notPassing.length);
console.log('First 20 not passing:');
notPassing.slice(0, 20).forEach(f => console.log(`  ${f.id} ${f.status} passes=${f.passes} - ${f.title}`));

// Check specific IDs from the pending list
const pendingIds = ['F0140', 'F0141', 'F0142', 'F0143', 'F0149', 'F0150'];
console.log('\nChecking specific IDs:');
pendingIds.forEach(id => {
  const f = data.features.find(feat => feat.id === id);
  if (f) {
    console.log(`  ${f.id}: status=${f.status}, passes=${f.passes}, priority=${f.priority}`);
  }
});
