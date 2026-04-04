const fs = require('fs');

const featuresPath = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json';
const features = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));

const categories = ['Outbound', 'Calendar', 'Function Tools', 'SMS'];
const p1 = features.features.filter(x =>
  x.priority === 'P1' &&
  !x.passes &&
  categories.includes(x.category)
).slice(0, 20);

p1.forEach(x => {
  console.log(`${x.id} [${x.category}] - ${x.title}`);
  console.log(`  Description: ${x.description}`);
  console.log('');
});

console.log(`\nTotal shown: ${p1.length}`);
