// DEV ONLY: builds a local test copy of the game in /tmp/platypug-harness that
//  - swaps real Firebase for scripts/test/fakefb.js (multi-tab Platytag in one headless browser context)
//  - shortens the Platytag head start to 2s
//  - exposes debug hooks: window.__st() = state, window.__mp() = mp, window.__furn() = FURN_LIST, window.__pfa() = bunny view
//  - PFA_TIME=<seconds> env var shortens Pug for All rounds
// Usage: node build.js && node scripts/test/harness.js && (cd /tmp/platypug-harness && python3 -m http.server 8765)
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", ".."), out = "/tmp/platypug-harness";
let s = fs.readFileSync(path.join(root, "index.html"), "utf8");
const swap = (a, b) => { if(!s.includes(a)) throw new Error("harness: marker not found: " + a); s = s.replace(a, b); };
swap('<script src="vendor/firebase-app-compat.js"></script>', '<script src="fakefb.js"></script>');
swap('<script src="vendor/firebase-database-compat.js"></script>', '');
swap('const HEAD_START = 15;', 'const HEAD_START = 2;');
swap('  function decoyFrame(){', '  window.__st = () => state; window.__mp = () => mp; window.__furn = () => FURN_LIST;\n  function decoyFrame(){');
if(process.env.PFA_TIME) swap('const PFA_TIME = 150;', 'const PFA_TIME = ' + process.env.PFA_TIME + ';');
swap('  function pfaReset(){', '  window.__pfa = () => pfa; window.__me = () => Net.myId();\n  function pfaReset(){');
fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, "index.html"), s);
fs.copyFileSync(path.join(__dirname, "fakefb.js"), path.join(out, "fakefb.js"));
fs.cpSync(path.join(root, "vendor"), path.join(out, "vendor"), {recursive: true});
console.log("harness ready: " + out + " (serve it on 127.0.0.1:8765)");
