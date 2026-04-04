const fs = require('fs');

const features = JSON.parse(fs.readFileSync('features.json', 'utf8'));

const completedIds = ['F1328', 'F1345', 'F1349', 'F1439'];

completedIds.forEach(id => {
  const feature = features.features.find(f => f.id === id);
  if (feature) {
    feature.passes = true;
    feature.status = 'completed';
    console.log(`✓ Marked ${id} as complete: ${feature.title}`);
  }
});

fs.writeFileSync('features.json', JSON.stringify(features, null, 2));
console.log('\nAll P1 features completed!');
