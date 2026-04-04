const fs = require('fs');
const data = JSON.parse(fs.readFileSync('features.json', 'utf8'));

// Get incomplete P0 and P1 features
const incomplete = data.features.filter(f => f.passes != true);
const p0 = incomplete.filter(f => f.priority === 'P0');
const p1 = incomplete.filter(f => f.priority === 'P1').slice(0, 20);

console.log('=== P0 Features (Critical) ===');
p0.forEach(f => {
  console.log(`${f.id}: ${f.title}`);
  console.log(`  Category: ${f.category}`);
  console.log(`  Description: ${f.description}`);
  console.log(`  Acceptance: ${f.acceptance}`);
  console.log('');
});

console.log('\n=== P1 Features (High Priority - First 20) ===');
p1.forEach(f => {
  console.log(`${f.id}: ${f.title}`);
  console.log(`  Category: ${f.category}`);
  console.log(`  Description: ${f.description}`);
  console.log(`  Acceptance: ${f.acceptance}`);
  console.log('');
});
