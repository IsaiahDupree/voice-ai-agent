const f = require('./features.json');

// Find pending P0/P1 features in Vapi and Inbound categories
const pending = f.features.filter(x =>
  !x.passes &&
  (x.category === 'Vapi' || x.category === 'Inbound') &&
  (x.priority === 'P0' || x.priority === 'P1')
).slice(0, 20);

console.log('🎯 Next Priority Features (P0/P1):\n');
pending.forEach(p => {
  console.log(`${p.id} [${p.priority}] ${p.category}: ${p.title}`);
  console.log(`   └─ ${p.description}`);
  console.log('');
});

console.log(`\n📊 Found ${pending.length} pending P0/P1 features in Vapi/Inbound`);

// Also check what Outbound P0 features exist
const outboundP0 = f.features.filter(x =>
  !x.passes &&
  x.category === 'Outbound' &&
  x.priority === 'P0'
).slice(0, 10);

console.log(`\n🚀 Outbound P0 Features (${outboundP0.length} total):\n`);
outboundP0.forEach(p => {
  console.log(`${p.id} [${p.priority}] ${p.title}`);
});
