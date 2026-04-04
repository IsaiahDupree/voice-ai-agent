const fs = require('fs');
const features = JSON.parse(fs.readFileSync('features.json'));

const pending = features.features.filter(x => !x.passes);
const byPriority = {};

pending.forEach(x => {
  byPriority[x.priority] = (byPriority[x.priority] || 0) + 1;
});

console.log('Pending features by priority:');
Object.keys(byPriority).sort().forEach(p => {
  console.log(`  ${p}: ${byPriority[p]}`);
});

console.log('\nFirst 20 P2 pending:');
const p2 = pending.filter(x => x.priority === 'P2');
p2.slice(0, 20).forEach(x => {
  console.log(`  ${x.id} [${x.category}] ${x.title}`);
});
