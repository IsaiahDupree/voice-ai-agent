const f = require('./features.json');
const ids = ['F1328', 'F1345', 'F1349', 'F1439', 'F1483', 'F1484', 'F1485', 'F1486', 'F1487'];
const features = f.features.filter(x => ids.includes(x.id));
features.forEach(x => {
  console.log(`\n${x.id} - ${x.title}`);
  console.log(`Category: ${x.category}, Priority: ${x.priority}`);
  console.log(`Description: ${x.description}`);
  console.log(`Acceptance: ${x.acceptance_criteria}`);
});
