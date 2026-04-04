const fs = require('fs');
const data = JSON.parse(fs.readFileSync('features.json'));
const pending = data.features.filter(f => !f.passes);
console.log('Total pending:', pending.length);
console.log('\nNext 10 pending features:');
pending.slice(0, 10).forEach(f => {
  console.log(`${f.id} [${f.priority}] ${f.category}: ${f.title}`);
});
