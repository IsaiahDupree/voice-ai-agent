// Mark CRM and HumanHandoff features as complete
const fs = require('fs');

const featuresToComplete = [
  'F0593', // Contact RLS
  'F0594', // Contact RBAC
  'F0598', // Contact segment by stage
  'F0600', // Contact health check
  'F0602', // Contact full-text search
  'F0605', // Contact email validation
  'F0606', // Contact updated_at
  'F0608', // Contact note from agent
  'F0617', // Contact audit log
  'F0621', // Contact pagination
  'F0622', // Contact filter by date
  'F0624', // CRM contact analytics
  'F0636', // Handoff trigger: high value
  'F0637', // Handoff trigger: frustration
  'F0638', // Handoff trigger: compliance
];

const data = JSON.parse(fs.readFileSync('features.json', 'utf8'));
const features = data.features || data;

let updated = 0;

features.forEach(feature => {
  if (featuresToComplete.includes(feature.id) && !feature.passes) {
    feature.passes = true;
    feature.status = 'completed';
    updated++;
    console.log(`✓ Marked ${feature.id} as complete: ${feature.title}`);
  }
});

// Write back
const output = data.features ? data : { features };
fs.writeFileSync('features.json', JSON.stringify(output, null, 2));

console.log(`\nUpdated ${updated} features`);

// Show progress
const passing = features.filter(f => f.passes).length;
const total = features.length;
console.log(`Progress: ${passing}/${total} (${Math.round(passing/total*100)}%)`);
