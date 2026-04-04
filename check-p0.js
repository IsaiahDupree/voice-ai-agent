const fs = require('fs');
const data = JSON.parse(fs.readFileSync('features.json'));
const p0_pending = data.features.filter(f => !f.passes && f.priority === 'P0');
console.log('Total P0 pending:', p0_pending.length);
console.log('\nP0 pending features:');
p0_pending.forEach(f => {
  console.log(`${f.id} ${f.category}: ${f.title}`);
  console.log(`  Description: ${f.description}`);
  console.log(`  Acceptance: ${f.acceptance}\n`);
});
