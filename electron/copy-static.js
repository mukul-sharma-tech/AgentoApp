/**
 * Run after `next build` to copy static assets into the standalone folder.
 * next build --standalone puts server.js in .next/standalone but doesn't
 * copy .next/static or public — we need to do that manually.
 */
const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const root = path.join(__dirname, "..");

copyDir(
  path.join(root, ".next/static"),
  path.join(root, ".next/standalone/.next/static")
);

copyDir(
  path.join(root, "public"),
  path.join(root, ".next/standalone/public")
);

console.log("✓ Static assets copied into .next/standalone");
