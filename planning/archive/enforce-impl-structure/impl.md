---
title: "Enforce Impl Structure"
date: 2026-03-21
status: completed
---

# Enforce Impl Structure

## Goal

Prevent impl docs from being written with missing gate sections. Every phase must have verification, context, and document sections — enforced at write time by a hook.

## Checklist

### Phase 1: Hook Script

- [x] Update `apps/indusk-mcp/hooks/check-gates.js` — add override parity:
  1. When checking if a gate item is complete, also treat these as complete:
     - Item text contains `(none needed)` or `(not applicable)`
     - Item text contains `skip-reason:`
  2. Update the block message to suggest overrides: "To skip, mark the item with `skip-reason: {why}` or `(none needed)`"
- [x] Create `apps/indusk-mcp/hooks/validate-impl-structure.js` — PreToolUse hook on Edit|Write:
  1. Read JSON from stdin
  2. If `file_path` doesn't match `**/impl.md` → exit 0
  3. Determine the new content (after edit)
  4. Find all `### Phase N` headers in the new content
  5. For each phase, check for: `#### Phase N Verification`, `#### Phase N Context`, `#### Phase N Document`
  6. If a phase has implementation items (`- [ ]`) but is missing any section → exit 2 with message
  7. Allow explicit opt-out with reason: section exists and contains one of:
     - `(none needed)` or `(not applicable)` — no reason required
     - `skip-reason: {explanation}` — agent explains why, visible in the impl as a paper trail
     - `<!-- skip-gates -->` — escape hatch for the entire edit (same as execution hooks)
  8. When the hook blocks, the message should suggest the opt-out: "Phase 3 is missing Document section. If this phase has no docs to write, add `#### Phase 3 Document` with `(none needed)`. If you need to skip temporarily, use `skip-reason: {why}`."
  9. Only validate phases that are being added/modified in this edit — don't block edits to existing phases that were already missing sections
- [x] Add the hook to init's hook installation (hookFiles array + settings.json PreToolUse config)
- [x] Add the hook to update's hook sync

#### Phase 1 Verification
- [x] check-gates: gate item with `(none needed)` treated as complete → exit 0
- [x] check-gates: gate item with `skip-reason: no docs site` treated as complete → exit 0
- [x] check-gates: block message includes override suggestion
- [x] Pipe a simulated Write with a phase missing Document section → exit 2 with correct message
- [x] Pipe a simulated Write with all sections present → exit 0
- [x] Pipe a simulated Write with `#### Phase 1 Document` containing `(none needed)` → exit 0
- [x] Pipe a simulated Write with `skip-reason: no docs site` in Document section → exit 0
- [x] Pipe a simulated Edit that only checks a checkbox (not adding phases) → exit 0
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` passes
- [x] `pnpm check` passes

#### Phase 1 Context
- [x] Add to Conventions: every impl phase must have verification, context, and document sections — enforced by hook

#### Phase 1 Document
- [ ] Update `apps/indusk-docs/src/guide/gate-enforcement.md` to cover both execution gates and structure validation

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/hooks/check-gates.js` | Add override parity (none needed, skip-reason) |
| `apps/indusk-mcp/hooks/validate-impl-structure.js` | New — structure validation hook |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Add to hookFiles array |
| `apps/indusk-mcp/src/bin/commands/update.ts` | Add to hook sync |

## Dependencies
- enforce-plan-gates hooks infrastructure (completed)
