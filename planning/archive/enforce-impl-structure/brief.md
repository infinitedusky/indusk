---
title: "Enforce Impl Structure"
date: 2026-03-21
status: accepted
---

# Enforce Impl Structure — Brief

## Bug

The plan skill writes impl docs. The template says every phase should have four sections: implementation items, verification, context, and document. But nothing validates that the impl was written correctly. In poker-agent-runner-1 and poker-agent-runner-2, impls were written with missing context and document sections — the execution hooks had nothing to enforce because the gates were never created.

The enforce-plan-gates hooks prevent skipping gates during `/work`. But they can't enforce gates that don't exist. If a phase has no `#### Phase N Document` section, the hook sees zero items and says "all gates pass."

## Fix

A PreToolUse hook on Edit|Write that validates impl structure when phases are being written. When a new phase is added to an impl.md, check that it includes all four section types. Block the edit if sections are missing.

Specifically:
- Detect when an Edit/Write to `**/impl.md` adds or modifies a `### Phase N` block
- Validate the phase has: implementation items (at least one `- [ ]`), `#### Phase N Verification`, `#### Phase N Context`, `#### Phase N Document`
- If any section is missing, block with: "Phase 3 is missing Document section. Every phase needs: verification, context, document."
- Allow phases that explicitly opt out: `#### Phase N Document` with `(none needed)` or similar
- Don't block edits that aren't adding/modifying phase structure (checking items, adding notes, etc.)

## Scope

### In Scope
- New hook script `validate-impl-structure.js` or extend `check-gates.js`
- Hook installation in init/update
- Updated plan skill to reference the enforcement

### Out of Scope
- Validating impl content quality (are verification commands specific enough, etc.)
- Retroactively fixing existing impls
- Validating research/brief/ADR structure

## Success Criteria
- Agent cannot write an impl phase without all four sections
- Agent gets specific feedback about which section is missing
- Phases can opt out explicitly (`(none needed)`)
- Existing impls with missing sections are not blocked during work execution (only new writes)
