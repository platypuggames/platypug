// Builds the TEST site: test/index.html, served at https://platypuggames.github.io/platypug/test/
// It is the game built from the current src/ (normally the `dev` branch: unconfirmed changes), plus:
//   - assets loaded from the live site's folders (../vendor/, ../favicon…)
//   - its own Platytag rooms (ROOM_PREFIX "test_") so testers never mix with live web/app players
//   - a "TEST" badge with the build stamp, "TEST ·" title, and noindex
// Usage: node scripts/build-test.js [outDir]   (default: ./test). The iOS app never includes test/.
const fs = require("fs"), path = require("path"), cp = require("child_process");
const root = path.join(__dirname, "..");
const order = fs.readFileSync(path.join(root, "src", "manifest.txt"), "utf8").split("\n").map(s => s.trim()).filter(Boolean);
let s = order.map(f => fs.readFileSync(path.join(root, "src", f), "utf8")).join("");
let stamp = "";
try { stamp = cp.execSync("git rev-parse --short HEAD", {cwd: root}).toString().trim(); } catch(e) {}
stamp = (stamp ? stamp + " · " : "") + new Date().toISOString().slice(5, 16).replace("T", " ") + " UTC";
const swap = (a, b, all) => {
  if(!s.includes(a)) throw new Error("build-test: marker not found: " + a);
  s = all ? s.split(a).join(b) : s.replace(a, b);
};
swap('src="vendor/', 'src="../vendor/', true);
swap('href="vendor/', 'href="../vendor/', true);
for(const f of ["favicon-32.png", "favicon-48.png", "icon-192.png", "apple-touch-icon.png"]) swap(`href="${f}"`, `href="../${f}"`);
swap('const ROOM_PREFIX = "";', 'const ROOM_PREFIX = "test_";');
swap("<title>Platypug: Hide and Seek</title>", '<title>TEST · Platypug</title>\n<meta name="robots" content="noindex">');
swap("</body>", `<div id="test-badge" style="position:fixed;right:6px;bottom:max(6px,env(safe-area-inset-bottom));z-index:9998;background:#E5484D;color:#fff;font:700 11px/1.2 system-ui,sans-serif;padding:4px 8px;border-radius:999px;pointer-events:none;opacity:.9">TEST · ${stamp}</div>\n</body>`);
const outDir = path.resolve(process.argv[2] || path.join(root, "test"));
fs.mkdirSync(outDir, {recursive: true});
fs.writeFileSync(path.join(outDir, "index.html"), s);
console.log("built test site -> " + path.join(outDir, "index.html") + " (" + stamp + ")");
