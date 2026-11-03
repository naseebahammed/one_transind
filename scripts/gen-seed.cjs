// One-off: runs the dashboard's own seeded mock generators and dumps deals/invoices/log to data/seed.json.
const fs = require("fs"), vm = require("vm");
const lines = fs.readFileSync("public/app.js", "utf8").split("\n");
const end = lines.findIndex(l => l.startsWith("const ERP=")); // everything before this is pure data/generators
const ctx = vm.createContext({ console, setTimeout, Intl });
vm.runInContext(lines.slice(0, end).join("\n") + "\n;this.OUT={deals:DATA.deals,invoices:DATA.invoices,log:DATA.log}", ctx);
fs.writeFileSync("data/seed.json", JSON.stringify(ctx.OUT, null, 1));
console.log(Object.entries(ctx.OUT).map(([k, v]) => k + ":" + v.length).join(" "));
