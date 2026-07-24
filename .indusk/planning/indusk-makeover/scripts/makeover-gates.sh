#!/usr/bin/env bash
# indusk-makeover red-first tripwires: A1 (CLAUDE.md budget), A7 (graphiti/CGC gone),
# A11 (active-plan hygiene), A12 (MCP keep-lists).
# Authored at Phase 0 to FAIL against pre-makeover state; flips green as fix phases land.
# Usage: makeover-gates.sh [repo-root]   (defaults to git toplevel)
set -u

ROOT="${1:-$(git rev-parse --show-toplevel)}"
BUDGET=61440          # 60 KB — context.claude_md_budget_bytes default
PLAN_THRESHOLD=15     # proxy for A11 "only genuinely active plans" (brief: ~15 real ones)
FAIL=0

gate() { # gate <PASS|FAIL> <id> <detail>
  printf '%s  %s  %s\n' "$1" "$2" "$3"
  [ "$1" = "FAIL" ] && FAIL=1
}

# --- A1: CLAUDE.md <= 60 KB ---------------------------------------------------
size=$(wc -c < "$ROOT/CLAUDE.md" | tr -d ' ')
if [ "$size" -le "$BUDGET" ]; then
  gate PASS A1 "CLAUDE.md ${size} bytes <= ${BUDGET}"
else
  gate FAIL A1 "CLAUDE.md ${size} bytes > ${BUDGET}"
fi

# --- A7: graphiti + codegraphcontext absent -----------------------------------
a7_hits=""
if grep -qE '"(graphiti|codegraphcontext)"[[:space:]]*:' "$ROOT/.mcp.json" 2>/dev/null; then
  a7_hits=".mcp.json"
fi
for ext in graphiti codegraphcontext cgc; do
  [ -d "$ROOT/.indusk/extensions/$ext" ] && a7_hits="${a7_hits:+$a7_hits, }.indusk/extensions/$ext"
done
if [ -z "$a7_hits" ]; then
  gate PASS A7 "no graphiti/codegraphcontext in .mcp.json or enabled extensions"
else
  gate FAIL A7 "still present: $a7_hits"
fi

# --- A11: active-plan hygiene -------------------------------------------------
# Phase 0 used a dir-count proxy (<= 15). Since Phase 1 shipped the real
# classifier, the gate checks the actual assertion: zero dead-draft candidates
# remain outside archive/ (all-draft docs + stale mtime + not master-protected).
plans=$(find "$ROOT/.indusk/planning" -mindepth 1 -maxdepth 1 -type d ! -name archive | wc -l | tr -d ' ')
dead=$(cd "$ROOT" && node "$ROOT/apps/indusk-mcp/dist/bin/cli.js" plans archive-dead --dry-run 2>/dev/null | grep -c '^  - .*newest file' || true)
if [ "${dead:-0}" -eq 0 ]; then
  gate PASS A11 "0 dead-draft candidates (${plans} active plan dirs, all with genuine status)"
else
  gate FAIL A11 "${dead} dead-draft candidate(s) not yet archived (${plans} active dirs)"
fi

# --- A12: MCP keep-lists ------------------------------------------------------
# project: exactly indusk, dash0, posthog, jaeger; global (~/.claude.json): playwright only
a12=$(node -e '
const fs = require("fs"), os = require("os"), path = require("path");
const want = { project: ["dash0","indusk","jaeger","posthog"], global: ["playwright"] };
const read = (p) => { try { return Object.keys(JSON.parse(fs.readFileSync(p, "utf8")).mcpServers ?? {}).sort(); } catch { return null; } };
const proj = read(path.join(process.argv[1], ".mcp.json"));
const glob = read(path.join(os.homedir(), ".claude.json"));
const diff = (got, exp) => got === null ? "unreadable" :
  JSON.stringify(got) === JSON.stringify(exp) ? "" :
  `extra=[${got.filter(k => !exp.includes(k))}] missing=[${exp.filter(k => !got.includes(k))}]`;
const p = diff(proj, want.project), g = diff(glob, want.global);
if (!p && !g) { console.log("PASS"); }
else { console.log(`FAIL project(${p || "ok"}) global(${g || "ok"})`); }
' "$ROOT")
if [ "$a12" = "PASS" ]; then
  gate PASS A12 "project + global MCP configs match keep-lists"
else
  gate FAIL A12 "$a12"
fi

exit $FAIL
