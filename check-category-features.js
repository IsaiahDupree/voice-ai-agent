const category = process.argv[2] || 'SMS';
const limit = parseInt(process.argv[3] || '10');

const f = require('./features.json');
const pending = f.features.filter(x => !x.passes && x.category === category);

pending.slice(0, limit).forEach(x => {
  console.log(x.id + ': ' + x.title);
});

console.log('\nTotal ' + category + ' pending: ' + pending.length);
