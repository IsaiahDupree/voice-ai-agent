#!/usr/bin/env node
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('features.json', 'utf8'));

const toolFeatures = data.features.filter(f =>
  f.priority === 'P1' &&
  f.passes !== true &&
  (f.title.toLowerCase().includes('tool') || f.category === 'FunctionTools')
);

console.log('P1 Function Tool Features:\n');
toolFeatures.slice(0, 20).forEach(f => {
  console.log(`${f.id} - ${f.title}`);
  console.log(`  ${f.description}`);
  console.log('');
});

console.log(`\nTotal: ${toolFeatures.length} pending`);
