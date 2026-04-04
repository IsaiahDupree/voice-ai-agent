const f = require("./features.json");
const p0 = f.features.filter(x => x.priority === "P0" && !x.passes);
console.log("P0 incomplete:", p0.length);
p0.forEach(x => console.log(x.id, "-", x.title));
