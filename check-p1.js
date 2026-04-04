const fs = require('fs');
const data = JSON.parse(fs.readFileSync('features.json'));
const p1_pending = data.features.filter(f => !f.passes && f.priority === 'P1');
console.log('Total P1 pending:', p1_pending.length);
console.log('\nFirst 20 P1 pending features:');
p1_pending.slice(0, 20).forEach(f => {
  console.log(`${f.id} ${f.category}: ${f.title}`);
  console.log(`  ${f.description}`);
  console.log(`  ✓ ${f.acceptance}\n`);
});
