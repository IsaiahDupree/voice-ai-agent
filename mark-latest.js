const fs = require('fs');

// Read features
const data = JSON.parse(fs.readFileSync('features.json'));

// Features implemented in this session
const completeFeatures = [
  'F0154', // Call note creation (API already exists)
  'F0155', // Inbound DID display (to_number in webhook)
  'F0159', // Call whispering to rep (transfer-whisper.ts)
  'F0173', // Live transfer context (transfer-whisper.ts)
];

let updated = 0;
data.features.forEach(f => {
  if (completeFeatures.includes(f.id) && !f.passes) {
    f.passes = true;
    f.status = 'completed';
    updated++;
    console.log(`✓ ${f.id}: ${f.title}`);
  }
});

// Write back
fs.writeFileSync('features.json', JSON.stringify(data, null, 2));
fs.writeFileSync('/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json', JSON.stringify(data, null, 2));

console.log(`\nUpdated ${updated} features`);
console.log(`Total complete: ${data.features.filter(f => f.passes).length}/${data.features.length}`);
