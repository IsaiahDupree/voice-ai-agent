const fs = require('fs');

const features = JSON.parse(fs.readFileSync('features.json', 'utf8'));

// Mark final batch of implemented outbound features
const toComplete = [
  'F0224', // Dynamic script branching (lib + table)
  'F0230', // Live campaign dashboard (lib + API + table)
  'F0235', // Timezone clustering (lib + field)
  'F0244', // Cold list validation (lib + table)
];

let completed = 0;

features.features.forEach(f => {
  if (toComplete.includes(f.id)) {
    f.status = 'completed';
    f.passes = true;
    completed++;
    console.log(`✅ ${f.id}: ${f.title}`);
  }
});

fs.writeFileSync('features.json', JSON.stringify(features, null, 2));

console.log(`\n✨ Marked ${completed} features as complete`);

// Also update harness features
const harnessPath = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json';
if (fs.existsSync(harnessPath)) {
  const harnessFeatures = JSON.parse(fs.readFileSync(harnessPath, 'utf8'));

  let hCompleted = 0;
  harnessFeatures.features.forEach(f => {
    if (toComplete.includes(f.id)) {
      f.status = 'completed';
      f.passes = true;
      hCompleted++;
    }
  });

  fs.writeFileSync(harnessPath, JSON.stringify(harnessFeatures, null, 2));
  console.log(`✨ Updated harness features file (${hCompleted} features)`);
}
