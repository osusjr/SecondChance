/**
 * Regenerates api/_catalog.json from js/data.js so the serverless
 * functions always answer from the same catalogue the site displays.
 *
 * Run after editing js/data.js:   node scripts/build-catalog.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dataSrc = fs.readFileSync(path.join(__dirname, "..", "js", "data.js"), "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(dataSrc, sandbox);

const products = sandbox.window.RAECAE_PRODUCTS.map((p) => ({
  id: p.id,
  brand: p.brand,
  title: p.title,
  category: p.category,
  era: p.era,
  year: p.year,
  price: p.price,
  condition: p.condition,
  tags: p.tags,
  story: p.story,
}));

const out = {
  currency: "JOD",
  categories: sandbox.window.RAECAE_CATEGORIES.filter((c) => c !== "All"),
  products,
};

fs.writeFileSync(
  path.join(__dirname, "..", "api", "_catalog.json"),
  JSON.stringify(out, null, 2) + "\n"
);
console.log(`api/_catalog.json written — ${products.length} pieces.`);
