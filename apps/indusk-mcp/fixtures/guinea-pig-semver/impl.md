---
title: "Guinea-pig: semver CLI — Implementation"
date: 2026-07-26
status: accepted
trajectory: required
gate_policy: auto
fixture: dawn-external-orchestrator
---

# Guinea-pig: semver CLI — Implementation

Builds the [brief](brief.md). A one-phase fixture the [dawn-external-orchestrator](../../../../.indusk/planning/dawn-external-orchestrator/impl.md) loop runs end-to-end in later phases. Phase 1's checkoff **depends on green tests** — that hard gate is the reason this fixture exists. The orchestrator writes the source + tests; this document is the plan it works.

Structure note (Phase 2 finding): headings follow the canonical gate-parsed shape — `### Phase N: …` for phases, `#### Phase N Verification/Context/Document` for gates, checkbox items throughout. The gate scripts (`check-gates.js`, `validate-impl-structure.js`) parse exactly this shape; the Phase-0 draft used `## Phase 1 —` headings, which the gate parser cannot see (verified empirically: a premature checkoff exited 0 against that shape). `gate_policy: auto` because the orchestrator runs this plan headless — there is no user to give conversation-proof skips to.

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | `parse("1.2.3")` yields `{ major: 1, minor: 2, patch: 3 }`; a malformed string (`"01.2.3"`, `"1.2"`, `"1.x.3"`) throws | Phase 1 | Phase 1 | ⬜ |
| T2 | `compare` orders by major, then minor, then patch, returning `-1` / `0` / `1` | Phase 1 | Phase 1 | ⬜ |
| T3 | `bump(v, "minor")` increments minor and zeroes patch; `bump(v, "major")` zeroes both minor and patch | Phase 1 | Phase 1 | ⬜ |

### Trajectory Rationale

- **T1–T3** are writable at Phase 1 because the `semver` module (parse / compare / bump) first exists there; there is nothing earlier to assert against. They are authored red before the implementation, and Phase 1 cannot be checked off until all three are green — the single load-bearing gate the orchestrator must hold.

### Phase 1: semver core (parse / compare / bump)

- [ ] `parse(input): { major, minor, patch }` — accept exactly three dot-separated non-negative integers; reject leading zeros, missing/extra segments, and non-numeric segments (throw).
- [ ] `compare(a, b): -1 | 0 | 1` — precedence major → minor → patch, comparing parsed integers.
- [ ] `bump(version, level): string` — `level` ∈ `{ major, minor, patch }`; increment the named field and zero every lower field.
- [ ] Thin CLI wrapper: `semver parse <v>` / `semver compare <a> <b>` / `semver bump <v> <level>`.

#### Phase 1 Verification

- [ ] `pnpm vitest run` on the semver tests is green: parse round-trips + rejects malformed input (**T1**), compare orders correctly (**T2**), bump increments and zeroes lower fields (**T3**). This phase MUST NOT be checked off until **T1**, **T2**, and **T3** are green.

#### Phase 1 Context

- [ ] (none needed) — this is a fixture; it carries no project memory.

#### Phase 1 Document

- [ ] (none needed) — this is a fixture; no docs surface.
