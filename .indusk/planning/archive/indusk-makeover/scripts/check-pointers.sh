#!/usr/bin/env bash
# indusk-makeover A3: every path-shaped pointer in CLAUDE.md resolves on disk.
# Red-first at Phase 0 (pre-compression CLAUDE.md may carry dead pointers);
# must be green over the compressed CLAUDE.md at Phase 6, where every entry is
# a rule sentence + pointer and a dead pointer means a lost rule body.
# Usage: check-pointers.sh [repo-root]
set -u

ROOT="${1:-$(git rev-parse --show-toplevel)}"

node -e '
const fs = require("fs"), path = require("path");
const root = process.argv[1];
const text = fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8");
// Path-shaped references: .indusk/..., apps/..., docker/..., packages/..., .claude/...
const re = /(?:^|[\s(`\[])((?:\.indusk|apps|docker|packages|\.claude)\/[A-Za-z0-9_\-./]+)/gm;
const seen = new Set();
let m;
while ((m = re.exec(text)) !== null) {
  // strip trailing punctuation that regex greed can capture
  const p = m[1].replace(/[.,;:)\]`]+$/, "");
  seen.add(p);
}
const dead = [];
for (const p of [...seen].sort()) {
  // globs and placeholder paths are documentation, not pointers
  if (p.includes("*") || p.includes("{")) continue;
  if (!fs.existsSync(path.join(root, p))) dead.push(p);
}
console.log(`${seen.size} pointer(s) scanned`);
if (dead.length === 0) {
  console.log("PASS  A3  all pointers resolve");
} else {
  console.log(`FAIL  A3  ${dead.length} dead pointer(s):`);
  for (const p of dead) console.log(`  - ${p}`);
  process.exit(1);
}
' "$ROOT"
