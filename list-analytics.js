const f = require('./features.json');
const pending = f.features.filter(x => !x.passes && x.category === 'Analytics');
pending.slice(0, 20).forEach(feat => {
  console.log(feat.id + ': ' + feat.title);
});
