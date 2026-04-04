const fs = require('fs');
const data = JSON.parse(fs.readFileSync('features.json', 'utf8'));
const incomplete = data.features.filter(f => f.passes != true).slice(0, 30);
console.log(JSON.stringify(incomplete.map(f => ({
  id: f.id,
  category: f.category,
  title: f.title,
  status: f.status,
  priority: f.priority
})), null, 2));
