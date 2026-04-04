const fs = require('fs');
const f = JSON.parse(fs.readFileSync('features.json'));
const pending = f.features.filter(x => !x.passes && x.priority === 'P2');
const categories = {};

pending.forEach(feat => {
  categories[feat.category] = (categories[feat.category] || 0) + 1;
});

console.log('Remaining P2 features by category:');
Object.entries(categories)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, count]) => {
    console.log('  ' + cat + ': ' + count);
  });

console.log('\nTotal remaining: ' + pending.length);
