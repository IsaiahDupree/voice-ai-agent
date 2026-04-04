const f = require("./features.json");
const incomplete = f.features.filter(x => !x.passes);
console.log("Features without passes=true:", incomplete.length);
console.log("\nFirst 20 incomplete features:");
incomplete.slice(0, 20).forEach(x => {
  console.log(`${x.id} [${x.priority || 'no-priority'}] ${x.status || 'no-status'} - ${x.title.substring(0, 70)}`);
});
