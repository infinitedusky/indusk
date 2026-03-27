---
title: "Gate Policy Enforcement — Prove the Conversation Happened"
date: 2026-03-24
status: draft
---

# Gate Policy Enforcement — Brief

## Problem
The `ask` gate policy has no enforcement. The agent can pre-fill `(none needed)` when writing an impl, and check off skipped gates during `/work` without actually asking the user. The hook accepts `(none needed)` in all modes, making `ask` and `auto` behaviorally identical.

## Proposed Direction
Two enforcement changes:

1. **At write time** (`validate-impl-structure.js`): In `ask` mode, reject `(none needed)` and `skip-reason:` when the impl is first written. Every gate must have a real item. Only `auto` mode allows pre-filled opt-outs. `strict` rejects all opt-outs.

2. **At execution time** (`check-gates.js`): In `ask` mode, skips must include proof of the conversation — both the agent's question and the user's response. Format: `(none needed — asked: "{question}" — user: "{answer}")`. The hook validates this structure.

## Scope
### In Scope
- Update `validate-impl-structure.js` to enforce policy at write time
- Update `check-gates.js` to enforce conversation proof at execution time
- Update work skill with the conversation proof format
- Update plan skill to explain the three modes

### Out of Scope
- Verifying the conversation actually happened (can't inspect chat history from a hook)
- Changing the default policy (stays `ask`)

## Success Criteria
- In `ask` mode, writing an impl with `(none needed)` in a gate section is blocked
- In `ask` mode, checking off a gate with `(none needed)` (no conversation proof) is blocked
- In `auto` mode, `(none needed)` and `skip-reason:` work as before
- In `strict` mode, no opt-outs at all
- The format `(none needed — asked: "..." — user: "...")` passes in `ask` mode

## Depends On
- `planning/archive/enforce-plan-gates/` (completed)
- `planning/archive/enforce-impl-structure/` (completed)
