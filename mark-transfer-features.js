// Mark transfer/handoff features as complete
const fs = require('fs');

const featuresToComplete = [
  'F0639', // Handoff trigger: configured phrase
  'F0642', // Warm transfer script
  'F0643', // Cold transfer flow
  'F0647', // Transfer voicemail
  'F0648', // Transfer timeout
  'F0650', // Transfer outcome tracking
  'F0653', // Transfer CRM note
  'F0656', // Rep availability check
  'F0661', // Transfer rate metric
  'F0662', // Transfer reason classification
  'F0670', // Transfer API endpoint
  'F0673', // Handoff context packet
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

// Show progress
const passing = features.filter(f => f.passes).length;
const total = features.length;
console.log(`Progress: ${passing}/${total} (${Math.round(passing/total*100)}%)`);
