const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json', 'utf8'));

const notPassing = data.features.filter(f => !f.passes);
const passing = data.features.filter(f => f.passes);

console.log('Total features:', data.features.length);
console.log('Features passing:', passing.length);
console.log('Features NOT passing:', notPassing.length);

if (notPassing.length > 0) {
  console.log('\nFirst 20 not passing:');
  notPassing.slice(0, 20).forEach(f => {
    console.log(`${f.id} [${f.priority}] ${f.status} passes:${f.passes} - ${f.title}`);
  });
}
