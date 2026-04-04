const fs = require('fs');

const features = JSON.parse(fs.readFileSync('features.json', 'utf8'));

const completed = features.features.filter(f => f.passes === true).length;
const total = features.features.length;
const remaining = total - completed;
const progress = Math.round((completed / total) * 100);

const status = {
  lastUpdated: new Date().toISOString(),
  total: total,
  completed: completed,
  remaining: remaining,
  progress: progress,
  status: progress === 100 ? 'complete' : 'in_progress'
};

fs.writeFileSync('harness-status.json', JSON.stringify(status, null, 2));

const metrics = {
  timestamp: new Date().toISOString(),
  features_completed: completed,
  features_remaining: remaining,
  progress_percentage: progress
};

fs.writeFileSync('harness-metrics.json', JSON.stringify(metrics, null, 2));

console.log('✓ Harness status updated');
console.log(`  Progress: ${progress}% (${completed}/${total})`);
console.log(`  Status: ${status.status}`);
