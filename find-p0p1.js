const fs = require('fs');
const features = JSON.parse(fs.readFileSync('features.json'));

const p0p1 = features.features
  .filter(f => (f.priority === 'P0' || f.priority === 'P1') && f.passes !== true)
  .slice(0, 20);

console.log('🎯 Next P0/P1 Features:\n');
p0p1.forEach(f => {
  console.log(`${f.id} [${f.priority}] ${f.category}: ${f.title}`);
  console.log(`   └─ ${f.description}\n`);
});

const totalPending = features.features.filter(f =>
  (f.priority === 'P0' || f.priority === 'P1') && f.passes !== true
).length;

console.log(`📊 Total pending P0/P1: ${totalPending}`);
