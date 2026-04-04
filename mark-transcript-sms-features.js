// Mark transcript and SMS features as complete
const fs = require('fs');

const featuresToComplete = [
  'F0473', // Transcript access control
  'F0481', // Transcript call playback
  'F0482', // Transcript compliance
  'F0484', // Transcript channel support
  'F0485', // Transcript timestamps offset
  'F0501', // Transcript ingestion queue
  'F0538', // SMS analytics
  'F0546', // Twilio test credentials
  'F0549', // SMS campaign batch
  'F0551', // SMS timezone awareness
  'F0552', // SMS error log
  'F0555', // SMS PII handling
  'F0563', // SMS unsubscribe page
  'F0585', // Contact import CSV
  'F0586', // Contact export CSV
];

const data = JSON.parse(fs.readFileSync('features.json', 'utf8'));
const features = data.features || data;

let updated = 0;

features.forEach(feature => {
  if (featuresToComplete.includes(feature.id) && !feature.passes) {
    feature.passes = true;
    feature.status = 'completed';
    updated++;
    console.log(`✓ Marked ${feature.id} as complete: ${feature.title}`);
  }
});

// Write back
const output = data.features ? data : { features };
fs.writeFileSync('features.json', JSON.stringify(output, null, 2));

console.log(`\nUpdated ${updated} features`);
