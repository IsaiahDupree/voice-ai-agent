const f = require("./features.json");

const incomplete = f.features.filter(x => !x.passes);

const byPriority = {
  P0: incomplete.filter(x => x.priority === 'P0'),
  P1: incomplete.filter(x => x.priority === 'P1'),
  P2: incomplete.filter(x => x.priority === 'P2'),
  'no-priority': incomplete.filter(x => !x.priority)
};

console.log("Incomplete features by priority:");
console.log("P0:", byPriority.P0.length);
console.log("P1:", byPriority.P1.length);
console.log("P2:", byPriority.P2.length);
console.log("No priority:", byPriority['no-priority'].length);

console.log("\n=== P0 Incomplete ===");
byPriority.P0.slice(0, 10).forEach(x => {
  console.log(`${x.id} - ${x.title}`);
});

console.log("\n=== P1 Incomplete ===");
byPriority.P1.slice(0, 10).forEach(x => {
  console.log(`${x.id} - ${x.title}`);
});

console.log("\n=== P2 Incomplete (first 10) ===");
byPriority.P2.slice(0, 10).forEach(x => {
  console.log(`${x.id} - ${x.title}`);
});
