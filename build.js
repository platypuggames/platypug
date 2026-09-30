// Builds index.html (the file GitHub Pages serves) by stitching src/ pieces together in manifest order.
//   node build.js          -> writes index.html
//   node build.js --check  -> fails if index.html doesn't match what src/ would build
const fs = require("fs"), path = require("path");
const root = __dirname, src = path.join(root, "src");
const order = fs.readFileSync(path.join(src, "manifest.txt"), "utf8").split("\n").map(s => s.trim()).filter(Boolean);
const out = order.map(f => fs.readFileSync(path.join(src, f), "utf8")).join("");
const target = path.join(root, "index.html");
if (process.argv.includes("--check")) {
  const cur = fs.readFileSync(target, "utf8");
  if (cur !== out) { console.error("index.html is out of date with src/ (run: node build.js)"); process.exit(1); }
  console.log("index.html matches src/ (" + out.length + " chars, " + order.length + " pieces)");
} else {
  fs.writeFileSync(target, out);
  console.log("built index.html (" + out.length + " chars from " + order.length + " pieces)");
}
