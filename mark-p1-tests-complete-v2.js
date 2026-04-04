const fs = require('fs');

const features = JSON.parse(fs.readFileSync('features.json', 'utf8'));

const completedIds = ['F1483', 'F1484', 'F1485', 'F1486', 'F1487'];

completedIds.forEach(id => {
  const feature = features.features.find(f => f.id === id);
  if (feature) {
    feature.passes = true;
    feature.status = 'completed';
    console.log(`✓ Marked ${id} as complete: ${feature.title}`);
  }
});

fs.writeFileSync('features.json', JSON.stringify(features, null, 2));
console.log('\nFeatures.json updated successfully!');
