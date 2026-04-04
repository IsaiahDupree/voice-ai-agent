const fs = require('fs');

const featuresPath = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json';
const features = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));

const p1 = features.features.filter(x => x.priority === 'P1' && !x.passes).slice(0, 30);
p1.forEach(x => {
  console.log(`${x.id} [${x.category}] - ${x.title}`);
});

console.log(`\nTotal P1 pending: ${features.features.filter(x => x.priority === 'P1' && !x.passes).length}`);
console.log(`Total completed: ${features.features.filter(x => x.passes).length}/1500`);
