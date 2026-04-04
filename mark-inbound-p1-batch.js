const fs = require('fs');

const features = JSON.parse(fs.readFileSync('features.json', 'utf8'));

// Mark F0145, F0151, F0169, F0176 as complete
const toComplete = ['F0145', 'F0151', 'F0169', 'F0176'];

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
