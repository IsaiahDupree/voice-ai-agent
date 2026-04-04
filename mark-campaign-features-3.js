// Mark more campaign features as completed

const fs = require('fs');

const featuresPath = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json';
const features = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));

const completedFeatures = [
  'F0225', // Outbound call rate limit
  'F0228', // Campaign scheduling
  'F0237', // Voicemail timestamp
  'F0241', // Agent script for outbound
  'F0250', // Contact skip logic
  'F0254', // Campaign audit log
  'F0259', // Outbound callId storage
  'F0261', // Campaign cooldown
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
console.log(`\nRecap of all features completed in this session:`);
console.log('  Inbound: F0145, F0151, F0169, F0176');
console.log('  Outbound/Campaign: F0199, F0205, F0207, F0208, F0210, F0213, F0220, F0225, F0228, F0237, F0241, F0246, F0250, F0254, F0259, F0261');
