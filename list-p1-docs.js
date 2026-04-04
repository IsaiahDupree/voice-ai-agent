const fs = require('fs');
const f = JSON.parse(fs.readFileSync('features.json'));
const p1 = f.features.filter(x=>x.priority==='P1'&&!x.passes);
const docs = p1.filter(x=>x.category==='Documentation');
console.log('P1 Documentation features:\n');
docs.forEach(x=>console.log(`${x.id} - ${x.title}`));
