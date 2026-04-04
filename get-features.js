const fs = require('fs');
const harnessPath = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json';
const data = JSON.parse(fs.readFileSync(harnessPath, 'utf8'));

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.log('Usage: node get-features.js F0140 F0141 ...');
  process.exit(1);
}

ids.forEach(id => {
  const f = data.features.find(feat => feat.id === id);
  if (f) {
    console.log(`\n${f.id} [${f.priority}] ${f.category}`);
    console.log(`Title: ${f.title}`);
    console.log(`Description: ${f.description}`);
    console.log(`Acceptance: ${f.acceptance}`);
    console.log(`Dependencies: ${JSON.stringify(f.dependencies)}`);
    console.log(`Status: ${f.status}, Passes: ${f.passes}`);
  } else {
    console.log(`\n${id} NOT FOUND`);
  }
});
