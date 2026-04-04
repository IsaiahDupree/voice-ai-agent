const fs = require('fs');

// Read features
const data = JSON.parse(fs.readFileSync('features.json'));

// Campaign features to mark complete based on code inspection
const completeFeatures = [
  'F0178', // Campaign list API
  'F0179', // Campaign get API
  'F0180', // Campaign update API
  'F0181', // Campaign delete API (saw in route.ts)
  'F0185', // Batch dial start (exists in /start/route.ts)
];

let updated = 0;
data.features.forEach(f => {
  if (completeFeatures.includes(f.id)) {
    f.passes = true;
    f.status = 'completed';
    updated++;
    console.log(`✓ ${f.id}: ${f.title}`);
  }
});

// Write back
fs.writeFileSync('features.json', JSON.stringify(data, null, 2));
console.log(`\nUpdated ${updated} features`);
