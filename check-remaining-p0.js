const fs = require('fs');
const data = JSON.parse(fs.readFileSync('features.json', 'utf8'));

const p0Remaining = data.features.filter(f => f.priority === 'P0' && f.passes != true);

console.log(`Remaining P0 features: ${p0Remaining.length}\n`);
p0Remaining.forEach(f => {
  console.log(`${f.id}: ${f.title}`);
  console.log(`  Description: ${f.description}`);
  console.log('');
});
