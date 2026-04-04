const f = require('./features.json');
const p1 = f.features.filter(x => x.priority === 'P1' && x.passes !== true);
console.log('P1 features to implement:', p1.length);
console.log('\nFirst 20 P1 features:');
p1.slice(0,20).forEach(x => console.log(`${x.id} [${x.category}] - ${x.title}`));
