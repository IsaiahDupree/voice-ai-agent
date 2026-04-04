const fs = require('fs');
const harnessPath = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json';
const data = JSON.parse(fs.readFileSync(harnessPath, 'utf8'));

// Get features with undefined status
const notDone = data.features.filter(f => f.status === undefined || f.passes !== true);

// Group by priority
const byPriority = {};
notDone.forEach(f => {
  const key = f.priority || 'undefined';
  if (!byPriority[key]) byPriority[key] = [];
  byPriority[key].push(f);
});

console.log('Features not done by priority:');
Object.entries(byPriority).forEach(([priority, features]) => {
  console.log(`\n${priority}: ${features.length} features`);

  // Group by category within priority
  const byCategory = {};
  features.forEach(f => {
    const cat = f.category || 'undefined';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(f);
  });

  Object.entries(byCategory).sort((a,b) => b[1].length - a[1].length).forEach(([cat, catFeatures]) => {
    console.log(`  ${cat}: ${catFeatures.length}`);
  });
});

// Show first 30 P0 and P1 features
console.log('\n\n=== First 30 P0/P1 features to implement ===');
const p0p1 = notDone.filter(f => f.priority === 'P0' || f.priority === 'P1');
p0p1.slice(0, 30).forEach(f => {
  console.log(`${f.id} [${f.priority}] ${f.category} - ${f.title}`);
});
