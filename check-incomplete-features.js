const fs = require('fs');
const data = JSON.parse(fs.readFileSync('features.json'));

const incomplete = data.features.filter(f => !f.passes || f.status !== 'completed');

console.log('Incomplete features:', incomplete.length);
console.log('\nFirst 30 IDs:', incomplete.slice(0,30).map(f => f.id).join(', '));
console.log('\nSample incomplete feature:');
console.log(JSON.stringify(incomplete[0], null, 2));

console.log('\nBy status:');
const byStatus = {};
incomplete.forEach(f => {
  const key = f.status || 'undefined';
  byStatus[key] = (byStatus[key] || 0) + 1;
});
console.log(JSON.stringify(byStatus, null, 2));
