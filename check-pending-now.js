const fs = require('fs');
const data = JSON.parse(fs.readFileSync('features.json', 'utf8'));
const f = data.features || data;
const pending = (Array.isArray(f) ? f : []).filter(x => x.status === 'pending' || !x.passes);
console.log('Total Pending:', pending.length);
console.log('\nTop pending (by priority):');
const byPri = {};
pending.forEach(x => {
  if (!byPri[x.priority]) byPri[x.priority] = [];
  byPri[x.priority].push(x);
});
['P0', 'P1', 'P2'].forEach(p => {
  if (byPri[p]) {
    console.log(`\n${p} (${byPri[p].length}):`);
    byPri[p].slice(0, 8).forEach(x => console.log(`  ${x.id} [${x.category}] ${(x.title || '?').substring(0, 60)}`));
  }
});
