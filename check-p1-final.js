const f = require('./features.json');

const p1All = f.features.filter(x => x.priority === 'P1');
const p1Done = f.features.filter(x => x.priority === 'P1' && x.passes === true);
const p1Remaining = f.features.filter(x => x.priority === 'P1' && x.passes !== true);

console.log('P1 Features:');
console.log('  Total:', p1All.length);
console.log('  Completed:', p1Done.length);
console.log('  Remaining:', p1Remaining.length);
console.log('');

if (p1Remaining.length > 0) {
  console.log('Remaining P1 features:');
  p1Remaining.slice(0, 10).forEach(x => {
    console.log(`  ${x.id} [${x.category}] - ${x.title}`);
  });
} else {
  console.log('✅ All P1 features completed!');
}

console.log('');
const allDone = f.features.filter(x => x.passes === true);
const allRemaining = f.features.filter(x => x.passes !== true);
console.log('Overall Progress:');
console.log(`  Completed: ${allDone.length}`);
console.log(`  Remaining: ${allRemaining.length}`);
console.log(`  Progress: ${Math.round(allDone.length / f.features.length * 100)}%`);
