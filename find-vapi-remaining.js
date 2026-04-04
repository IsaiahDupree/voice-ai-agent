const f = require('./features.json');

// Find pending Vapi features
const vapiPending = f.features.filter(x =>
  !x.passes &&
  x.category === 'Vapi'
);

console.log(`🎯 Remaining Vapi Features (${vapiPending.length} total):\n`);
vapiPending.forEach(p => {
  console.log(`${p.id} [${p.priority || 'P2'}] ${p.title}`);
  console.log(`   └─ ${p.description}`);
  console.log('');
});

// Count completed
const vapiCompleted = f.features.filter(x => x.passes && x.category === 'Vapi').length;
const vapiTotal = f.features.filter(x => x.category === 'Vapi').length;
console.log(`\n📊 Vapi: ${vapiCompleted}/${vapiTotal} complete`);
