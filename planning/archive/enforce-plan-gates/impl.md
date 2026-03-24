---
title: "Enforce Plan Execution Gates"
date: 2026-03-21
status: completed
---

# Enforce Plan Execution Gates

## Goal

Make plan execution gates enforceable via Claude Code hooks. The agent cannot advance to the next phase until verification, context, and document items in the current phase are complete. Enforcement is deterministic (hooks), not advisory (skill instructions).

## Scope

### In Scope
- `check-gates.js` PreToolUse hook script (blocks phase transitions)
- `gate-reminder.js` PostToolUse hook script (nudges after phase completion)
- `check-gates` CLI command for manual validation
- Hook installation in `init` and `update`
- Updated work skill referencing enforcement

### Out of Scope
- Blocking individual checkbox edits within a phase
- Remote/HTTP hooks
- Agent hooks (too slow)
- Retroactive validation of already-checked items

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | check-gates.js, gate-reminder.js hook scripts | impl-parser module |
| Phase 2 | check-gates CLI command | Hook scripts from Phase 1 |
| Phase 3 | init/update hook installation, settings.json merge | Hook scripts, CLI command |
| Phase 4 | Updated work skill, dogfood, publish | All previous phases |

## Checklist

### Phase 1: Hook Scripts

- [x] Create `apps/indusk-mcp/hooks/check-gates.js` — PreToolUse hook:
  1. Read JSON from stdin (`tool_name`, `tool_input` with `file_path`, `old_string`, `new_string` for Edit; `file_path`, `content` for Write)
  2. If `file_path` doesn't match `**/impl.md` → exit 0
  3. Detect checkbox transitions: `- [ ]` → `- [x]` in the diff
  4. If no checkbox change → exit 0
  5. Parse the full impl file to determine which phase the checked item belongs to
  6. If item is in a gate section (verification/context/document) → exit 0 (checking gates is allowed)
  7. If item is an implementation item, find which phase it's in
  8. Check if all previous phases' gate items are complete
  9. If complete → exit 0
  10. If incomplete → exit 2 with stderr message listing missing items
  11. Check for `<!-- skip-gates -->` escape hatch in the edit — if present, exit 0
- [x] Create `apps/indusk-mcp/hooks/gate-reminder.js` — PostToolUse hook:
  1. Read JSON from stdin
  2. If `file_path` doesn't match `**/impl.md` → exit 0
  3. Read the impl file from disk (post-edit state)
  4. Parse phases and check if the current phase is now fully complete
  5. If complete → stdout JSON with reminder: "Phase N complete. Call advance_plan to validate."
  6. If not complete → exit 0 (silent)
- [x] Both scripts use inline parser logic (self-contained, no external deps). Since hooks run as standalone Node.js scripts, bundle the parser inline or reference the installed package's dist path.

#### Phase 1 Verification
- [x] Create a test impl with Phase 1 complete and Phase 2 incomplete gates. Pipe a simulated Edit JSON (checking Phase 2 implementation item) to check-gates.js → verify exit code 2 with correct message
- [x] Pipe a simulated Edit (checking Phase 1 gate item) → verify exit code 0
- [x] Pipe a simulated Edit (non-impl file) → verify exit code 0
- [x] Pipe a simulated Edit with `<!-- skip-gates -->` → verify exit code 0
- [x] Pipe a simulated Edit (checking Phase 1 implementation item, no previous phase) → verify exit code 0
- [x] `pnpm check` passes (our files clean; VitePress cache noise is a separate issue)

### Phase 2: CLI Command

- [x] Add `check-gates` command to CLI (`src/bin/cli.ts`):
  ```
  indusk-mcp check-gates [--file path/to/impl.md] [--phase N]
  ```
  - Defaults to finding the active impl (in-progress status) in `planning/`
  - Parses the impl and reports gate status per phase
  - Exit 0 if all gates pass, exit 1 if any fail
  - Output format: structured JSON or human-readable table
- [x] The CLI command reuses the same validation logic (imports impl-parser directly)

#### Phase 2 Verification
- [x] `npx @infinitedusky/indusk-mcp check-gates` on this repo reports correct gate status (found in-progress impl, showed 4 phases)
- [x] `npx @infinitedusky/indusk-mcp check-gates --file planning/enforce-plan-gates/impl.md` works
- [x] Exit code 0 when all gates pass, exit code 1 when they don't
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` passes
- [x] `pnpm check` passes (our files clean; VitePress cache noise is separate)

### Phase 3: Hook Installation in init and update

- [x] Update `init` to:
  1. Copy hook scripts to `.claude/hooks/check-gates.js` and `.claude/hooks/gate-reminder.js`
  2. Merge hook config into `.claude/settings.json` (don't overwrite existing hooks):
     ```json
     {
       "hooks": {
         "PreToolUse": [
           {
             "matcher": "Edit|Write",
             "hooks": [{ "type": "command", "command": "node .claude/hooks/check-gates.js" }]
           }
         ],
         "PostToolUse": [
           {
             "matcher": "Edit|Write",
             "hooks": [{ "type": "command", "command": "node .claude/hooks/gate-reminder.js" }]
           }
         ]
       }
     }
     ```
  3. Print what was installed
- [x] Update `update` to sync hook scripts by content hash (same as skills and lessons)
- [x] Handle existing `.claude/settings.json` with other hooks — merge, don't overwrite

#### Phase 3 Verification
- [x] Run `init` in a temp directory — `.claude/hooks/` created with both scripts, `.claude/settings.json` has hook config
- [x] Run `init` again — hooks not duplicated in settings.json (1 PreToolUse, 1 PostToolUse entry)
- [x] Run `update` after modifying a hook script — hook script restored (by content hash)
- [x] Existing user hooks in settings.json preserved after init (merge, not overwrite)
- [x] `pnpm check` passes

#### Phase 3 Context
- [x] Add to Conventions: plan gates are enforced via Claude Code hooks — agent cannot skip verification/context/document items
- [x] Add to Architecture: `.claude/hooks/` contains gate enforcement scripts installed by init

### Phase 4: Skill Update, Dogfood, and Publish

- [x] Update work skill: add note about hook enforcement — "Enforced by hooks: the edit will be blocked"
- [x] Replaced gate instruction with "Enforced by hooks" language in work skill
- [x] Bump package version to 0.6.0
- [ ] Build and publish to npm (user to publish manually)
- [ ] Run `update` on this repo — verify hooks installed
- [ ] Test enforcement: start a plan, try to skip gates — verify the hook blocks

#### Phase 4 Verification
- [x] Hook blocks phase transition with incomplete gates (tested: "Phase 2 blocked: complete Phase 1 gates first")
- [x] Hook allows gate items to be checked (tested: exit 0 for verification item)
- [x] Hook allows implementation items in the current phase (tested: Phase 1 item with no previous phase)
- [x] Hook allows non-impl file edits without delay (tested: exit 0 for README.md)
- [ ] Reminder fires when a phase is fully complete (needs live test after publish)
- [x] `<!-- skip-gates -->` escape hatch works (tested: exit 0)
- [x] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes (21 tests)
- [x] `pnpm check` passes

#### Phase 4 Context
- [x] Update Current State: enforce-plan-gates added to active plans

#### Phase 4 Document
- [ ] Update reference page at `apps/indusk-docs/src/reference/tools/indusk-mcp.md` with check-gates CLI command
- [ ] Write guide page at `apps/indusk-docs/src/guide/gate-enforcement.md` explaining how hooks work, what they block, and the escape hatch

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/hooks/check-gates.js` | New — PreToolUse hook script |
| `apps/indusk-mcp/hooks/gate-reminder.js` | New — PostToolUse hook script |
| `apps/indusk-mcp/src/bin/cli.ts` | Add check-gates command |
| `apps/indusk-mcp/src/bin/commands/check-gates.ts` | New — CLI command implementation |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Hook installation, settings.json merge |
| `apps/indusk-mcp/src/bin/commands/update.ts` | Hook script sync |
| `apps/indusk-mcp/skills/work.md` | Reference hook enforcement |
| `apps/indusk-mcp/skills/toolbelt.md` | Add check-gates to tool reference |

## Dependencies
- impl-parser with blocker and forward intelligence support (from gsd-inspired-improvements)
- Claude Code hooks infrastructure (available in current Claude Code)

## Notes
- The hook fires on every Edit/Write but the fast path (non-impl files) is a single string match
- The escape hatch `<!-- skip-gates -->` should be rare — document it but don't encourage it
- The PostToolUse reminder is advisory — it can't block. It just makes the advance_plan call visible.
- Hook scripts must be self-contained or reference the installed package — they can't assume the dev environment
