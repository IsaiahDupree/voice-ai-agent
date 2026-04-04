// Mark F0145, F0151, F0169, F0176 as completed

const fs = require('fs');
const path = require('path');

const featuresPath = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json';
const features = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));

const completedFeatures = ['F0145', 'F0151', 'F0169', 'F0176'];

let updated = 0;

features.features = features.features.map(f => {
  if (completedFeatures.includes(f.id)) {
    updated++;
    return {
      ...f,
      status: 'completed',
      passes: true
    };
  }
  return f;
});

fs.writeFileSync(featuresPath, JSON.stringify(features, null, 2));

console.log(`✅ Marked ${updated} features as completed: ${completedFeatures.join(', ')}`);
