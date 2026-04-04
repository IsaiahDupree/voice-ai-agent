const f = require('./features.json');

const p0pending = f.features.filter(x => x.passes !== true && x.priority === 'P0');
const p1pending = f.features.filter(x => x.passes !== true && x.priority === 'P1');

console.log('P0 pending:', p0pending.length);
p0pending.slice(0, 10).forEach(x => console.log('  ', x.id, x.category, '-', x.title));

console.log('\nP1 pending:', p1pending.length);
p1pending.slice(0, 15).forEach(x => console.log('  ', x.id, x.category, '-', x.title));
