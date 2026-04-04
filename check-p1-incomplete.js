const fs = require('fs');
const f = JSON.parse(fs.readFileSync('features.json'));
const p1Incomplete = f.features.filter(x => x.priority === 'P1' && !x.passes);

console.log('P1 Incomplete count:', p1Incomplete.length);
console.log('\nFirst 30 P1 incomplete:\n');
p1Incomplete.slice(0,30).forEach((x,i) => {
  console.log(`${i+1}. ${x.id} - ${x.category} - ${x.title}`);
});
