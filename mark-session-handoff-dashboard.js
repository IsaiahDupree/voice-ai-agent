// Mark completed handoff and dashboard features
const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'features.json');
const data = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));

const completedFeatures = [
  // Dashboard features
  'F0687', // Active call columns
  'F0689', // Sentiment display
  'F0690', // Sentiment color coding
  'F0692', // WebSocket connection
  'F0693', // WebSocket reconnect
  'F0694', // Call end removal

  // Handoff features
  'F0645', // Transfer hold music
  'F0666', // Handoff config UI
  'F0672', // Rep offline fallback
  'F0675', // Post-handoff agent resume
  'F0676', // Handoff reason in transcript
  'F0678', // Transfer status in dashboard
  'F0679', // DTMF transfer trigger
  'F0681', // Transfer fallback SMS
  'F0682', // Warm transfer recording notice
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
