// Mark completed dashboard features batch 2
const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'features.json');
const data = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));

const completedFeatures = [
  // Call detail drawer
  'F0695', // Call detail drawer
  'F0696', // Call detail transcript
  'F0697', // Call detail contact
  'F0698', // Transfer button
  'F0699', // End call button

  // Call history enhancements
  'F0701', // Call history columns
  'F0702', // Call history filters
  'F0703', // Call history search
  'F0704', // Call history pagination
  'F0705', // Call history export

  // Campaign management
  'F0706', // Campaign tab
  'F0707', // Campaign progress bar
  'F0708', // Campaign start button
  'F0709', // Campaign stop button

  // Contacts
  'F0710', // Contacts tab
];

let updated = 0;

data.features.forEach((feature) => {
  if (completedFeatures.includes(feature.id)) {
    feature.status = 'completed';
    feature.passes = true;
    updated++;
    console.log(`✓ ${feature.id}: ${feature.title}`);
  }
});

fs.writeFileSync(featuresPath, JSON.stringify(data, null, 2));

console.log(`\n✅ Marked ${updated} features as completed`);

// Calculate new stats
const total = data.features.length;
const passing = data.features.filter((f) => f.passes).length;
const percentComplete = ((passing / total) * 100).toFixed(1);

console.log(`\n📊 Progress: ${passing}/${total} (${percentComplete}%)`);
