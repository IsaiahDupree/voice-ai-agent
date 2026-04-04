const f = require('./features.json');
const features = f.features;
const incomplete = features.filter(x => x.passes !== true);

const byPriority = {};
incomplete.forEach(x => {
  const p = x.priority || 'none';
  byPriority[p] = (byPriority[p] || 0) + 1;
});

console.log('Incomplete by priority:');
Object.entries(byPriority).sort().forEach(([p, c]) => {
  console.log(`  ${p}: ${c}`);
});

console.log('\nP0 incomplete:');
incomplete.filter(x => x.priority === 'P0').slice(0, 10).forEach(x => {
  console.log(`  ${x.id} - ${x.description}`);
});

console.log('\nP1 incomplete (first 10):');
incomplete.filter(x => x.priority === 'P1').slice(0, 10).forEach(x => {
  console.log(`  ${x.id} - ${x.description}`);
});
