const f = require('./features.json');
const p1 = f.features.filter(x => x.priority === 'P1' && !x.passes).slice(0, 30);
console.log('P1 incomplete (first 30):');
p1.forEach(x => console.log(`${x.id} - ${x.title}`));
console.log(`\nTotal P1 incomplete: ${f.features.filter(x => x.priority === 'P1' && !x.passes).length}`);
