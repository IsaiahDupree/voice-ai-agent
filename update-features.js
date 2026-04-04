const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'features.json');
const features = JSON.parse(fs.readFileSync(featuresPath, 'utf-8'));

// Features to mark as completed
const completedFeatures = [
  'F0001', 'F0002', 'F0003', 'F0004', 'F0005', 'F0006', 'F0007', 'F0008', 'F0009',
  'F0010', 'F0011', 'F0012', 'F0013', 'F0014', 'F0015', 'F0016', 'F0017', 'F0018',
  'F0019', 'F0020', 'F0021', 'F0022', 'F0023', 'F0024', 'F0025', 'F0026', 'F0027',
  'F0028', 'F0029', 'F0030', 'F0031', 'F0032', 'F0033', 'F0034',
];

// Update features
features.features = features.features.map(feature => {
  if (completedFeatures.includes(feature.id)) {
    return {
      ...feature,
      status: 'completed',
      passes: true
    };
  }
  return feature;
});

fs.writeFileSync(featuresPath, JSON.stringify(features, null, 2));
console.log(`Updated ${completedFeatures.length} features`);
