const fs = require('fs');

// Read features
const data = JSON.parse(fs.readFileSync('features.json'));

// Feature IDs to mark complete
const completeFeatures = ['F0139', 'F0187'];

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
