// Mark campaign features as completed

const fs = require('fs');

const featuresPath = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json';
const features = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));

const completedFeatures = [
  'F0199', // Voicemail drop text
  'F0205', // Retry delay
  'F0207', // Retry on busy
  'F0208', // Retry on voicemail
  'F0210', // Campaign progress tracking
  'F0213', // Campaign conversion rate
  'F0220', // Campaign report export
  'F0246', // Cost per call tracking
];

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
