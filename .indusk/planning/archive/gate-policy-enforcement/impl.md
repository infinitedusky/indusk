---
title: "Gate Policy Enforcement"
date: 2026-03-24
status: completed
workflow: bugfix
gate_policy: ask
---

# Gate Policy Enforcement

## Goal
Make the `ask` gate policy actually enforced — not just instructional. The agent must prove a conversation happened before skipping any gate.

## Checklist

### Phase 1: Hook Updates

- [x] Update `validate-impl-structure.js`: when `gate_policy` is `ask`, reject phases where gate sections contain only `(none needed)`, `(not applicable)`, or `skip-reason:` at write time. Only `auto` allows pre-filled opt-outs. `strict` rejects all opt-outs including the conversation proof format.
- [x] Update `check-gates.js`: when `gate_policy` is `ask`, reject gate items checked off with bare `(none needed)` or `skip-reason:`. Require the conversation proof format: `(none needed — asked: "{question}" — user: "{answer}")`. Validate that both `asked:` and `user:` are present and non-empty.
- [x] Update `check-gates.js`: in `auto` mode, accept `(none needed)`, `skip-reason:`, and the conversation proof format (all valid). In `strict` mode, reject everything except real completed items.

#### Phase 1 Verification
- [ ] Create a test impl with `gate_policy: ask` and `(none needed)` in a Document section — verify `validate-impl-structure.js` blocks the write
- [ ] Create a test impl with `gate_policy: auto` and `(none needed)` — verify it passes
- [ ] Create a test impl with `gate_policy: strict` and conversation proof format — verify it blocks
- [ ] Test `check-gates.js` with bare `(none needed)` in ask mode — verify it blocks
- [ ] Test `check-gates.js` with `(none needed — asked: "Can I skip?" — user: "yes")` in ask mode — verify it passes
- [x] `pnpm check` passes

### Phase 2: Skill Updates

- [x] Update work skill: document the conversation proof format for `ask` mode. When the agent wants to skip a gate, it must ask the user, include the question and answer in the format, then check it off.
- [x] Update plan skill: explain that in `ask` mode, every gate section must have a real item when the impl is written. Opt-outs happen during `/work`, not during `/plan`.
- [x] Update toolbelt skill: add the three-mode summary table (strict/ask/auto) with what each allows

#### Phase 2 Verification
- [x] Read updated skills and verify the format is clearly documented
- [x] `pnpm check` passes

## Files Affected
| File | Change |
|------|--------|
| `apps/indusk-mcp/hooks/validate-impl-structure.js` | Reject opt-outs in ask/strict at write time |
| `apps/indusk-mcp/hooks/check-gates.js` | Require conversation proof in ask mode |
| `apps/indusk-mcp/skills/work.md` | Document conversation proof format |
| `apps/indusk-mcp/skills/plan.md` | Explain write-time enforcement per mode |
| `apps/indusk-mcp/skills/toolbelt.md` | Three-mode summary |

## Dependencies
- Hooks already installed and working (enforce-plan-gates, enforce-impl-structure)
