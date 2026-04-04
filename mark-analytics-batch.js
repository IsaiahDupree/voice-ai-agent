// Mark completed analytics features
const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'features.json');
const data = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));

const completedFeatures = [
  'F0712', // Analytics tab
  'F0714', // Calls per day chart
  'F0715', // Bookings per day chart
  'F0717', // Outcome distribution chart
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
