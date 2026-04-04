const fs = require('fs');
const path = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json';

const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const idsToMark = ['F1185', 'F1186', 'F1187', 'F1188'];

data.features = data.features.map(f => {
  if (idsToMark.includes(f.id)) {
    return { ...f, status: 'completed', passes: true };
  }
  return f;
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Marked F1185-F1188 as completed');
