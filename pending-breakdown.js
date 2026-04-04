const fs = require('fs');
const data = JSON.parse(fs.readFileSync('features.json', 'utf8'));
const pending = (data.features || []).filter(x => !x.passes);

const byCategory = {};
pending.forEach(x => {
  if (!byCategory[x.category]) byCategory[x.category] = [];
  byCategory[x.category].push(x);
});

console.log('Pending by Category:');
Object.entries(byCategory)
  .sort((a,b) => b[1].length - a[1].length)
  .forEach(([cat, items]) => {
    console.log(`${cat}: ${items.length}`);
  });
