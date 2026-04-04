const f = require('./features.json');
const pending = f.features.filter(x => !x.passes).slice(0, 10);
console.log(JSON.stringify(pending, null, 2));
