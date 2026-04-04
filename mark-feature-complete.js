#!/usr/bin/env node
// Helper script to mark features as complete in features.json

const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'features.json');

// Read feature IDs from command line args
const featureIds = process.argv.slice(2);

if (featureIds.length === 0) {
  console.log('Usage: node mark-feature-complete.js F0001 F0002 ...');
  process.exit(1);
}

// Read features.json
const data = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));

let updatedCount = 0;

// Update each feature
featureIds.forEach(id => {
  const feature = data.features.find(f => f.id === id);

  if (feature) {
    feature.passes = true;
    feature.status = 'completed';
    updatedCount++;
    console.log(`✓ Marked ${id} as complete: ${feature.title}`);
  } else {
    console.log(`✗ Feature ${id} not found`);
  }
});

// Write back to file
if (updatedCount > 0) {
  fs.writeFileSync(featuresPath, JSON.stringify(data, null, 2));
  console.log(`\n${updatedCount} features marked as complete`);

  // Update stats
  const passing = data.features.filter(f => f.passes).length;
  const total = data.features.length;
  const percent = ((passing / total) * 100).toFixed(1);

  console.log(`\nProgress: ${passing}/${total} (${percent}%)`);
}
