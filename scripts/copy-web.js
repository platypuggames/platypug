// Copies the playable game (index.html + vendor/) into www/, the folder the iPhone app bundles.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), out = path.join(root, "www");
fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
fs.copyFileSync(path.join(root, "index.html"), path.join(out, "index.html"));
fs.cpSync(path.join(root, "vendor"), path.join(out, "vendor"), {recursive: true});
console.log("www/ ready");
