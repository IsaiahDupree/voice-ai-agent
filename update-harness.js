#!/usr/bin/env node
const fs = require('fs');
const harnessPath = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json';

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.log('Usage: node update-harness.js F0140 F0141 ...');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(harnessPath, 'utf8'));
let updated = 0;

ids.forEach(id => {
  const f = data.features.find(feat => feat.id === id);
  if (f) {
    f.passes = true;
    f.status = 'completed';
    console.log(`✓ Marked ${id} as completed: ${f.title}`);
    updated++;
  } else {
    console.log(`✗ ${id} NOT FOUND`);
  }
});

if (updated > 0) {
  fs.writeFileSync(harnessPath, JSON.stringify(data, null, 2));
  console.log(`\nUpdated ${updated} features in harness file`);

  // Show progress
  const passing = data.features.filter(f => f.passes === true).length;
  const total = data.features.length;
  const percent = ((passing / total) * 100).toFixed(1);
  console.log(`Progress: ${passing}/${total} (${percent}%)`);
}
