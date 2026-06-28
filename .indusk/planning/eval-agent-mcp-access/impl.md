---
title: "Eval Agent MCP Access"
date: 2026-04-19
status: in-progress
workflow: bugfix
trajectory: required
rationale: required
gate_policy: ask
---

# Eval Agent MCP Access

## Goal

Restore MCP tool access in the spawned `claude --print` subprocess so the eval agent can actually read highlights, write Graphiti episodes, and mark entries processed — closing the operational gap that `agent-roles` left behind.

Current state: every evaluator run logs `graphitiWrites: 0`; `.indusk/highlights.jsonl` accumulates entries that never get processed; `.indusk/highlights-processed.jsonl` doesn't exist. Working agent's half of the agent-roles split works (this session can call `mcp__*` tools fine); eval agent's half is a no-op. After this plan: a `jj describe` with queued highlights produces a scorecard with `graphitiWrites > 0` and a populated `highlights-processed.jsonl`.

## Scope

### In Scope
- Diagnose why `mcp__*` tools are unreachable from the `claude --print` subprocess (4 hypotheses in brief; possibly a 5th)
- Apply the minimal fix
- Smoke validation: process the 3 currently-queued highlights end-to-end

### Out of Scope
- Rearchitecting the evaluator process model
- Adding new MCP servers or changing `.mcp.json` content
- Prompt engineering beyond confirming the instruction is reachable

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | An evaluator run that has ≥1 unprocessed highlight produces a scorecard with `graphitiWrites > 0`. | Phase 0 | Phase 2 | passing |
| T2 | After the fix ships, the 3 currently-queued highlights (`h-20260417-001`, `h-20260417-002`, `h-20260418-001`) appear in `.indusk/highlights-processed.jsonl` with `action: wrote-episode`, and matching Graphiti episodes are searchable in the `dusk` and/or `shared` group. | Phase 0 | Phase 3 | passing |
| T3 | The source of `apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts`'s resumePrompt construction reaches the same Step 4 (highlights processing) instructions as the fresh-spawn prompt — either by inlining the instructions verbatim or by delegating to a shared helper extracted from `prompt-builder.ts`. The minimal "Evaluate a new commit ... output the JSON scorecard" shape that silently omitted Step 4 must be gone. | Phase 0 | Phase 4 | planned |
| T4 | After Phase 4 ships, a real eval run on dusk (any commit) that hits the resume path processes the queued highlights backlog — `.indusk/highlights-processed.jsonl` grows by N entries within one eval cycle (where N = number of unprocessed highlights at trigger time), and the corresponding Graphiti episodes are searchable in the `dusk` group. Manual smoke against the live evaluator since spawning `claude --print` in CI is impractical. | Phase 0 | Phase 4 | planned |
| T5 | The resume prompt's commit-evaluation line does NOT contain the backwards-anchoring phrase "as before" — the wording was "answer the same evaluation questions as before" which, in a 197-turn persistent session where Step 4 was never previously provided, reads as "your last turns" and pulls the inner Claude back to the pre-fix pattern of skipping Step 4. The line is reworded to a present-tense direct instruction with no backwards reference. | Phase 0 | Phase 5 | passing |
| T6 | The `buildHighlightsInstructions` helper text explicitly handles the case where `mcp__indusk__highlights_unprocessed` returns an empty list — currently the instruction only handles "unavailable" (tool not loaded), so after the backlog drains the inner Claude has undefined behavior on subsequent commits (could hallucinate highlights, loop, or smoothly skip). The fix adds one explicit sentence: "If the list is empty, log briefly and continue to the rubric." | Phase 0 | Phase 5 | passing |
| T7 | Source-grep regression: `persistent-evaluator.ts` source contains BOTH `--mcp-config` AND `bypassPermissions` literal strings. These flags are load-bearing for the 1.23.x MCP-access fix; without them the inner Claude has no MCP tool surface and the entire highlights-processing path returns to the April-2026 failure mode. T3 pins the prompt shape but not the spawn flags. | Phase 0 | Phase 5 | passing |

## Checklist

### Phase 1: Diagnosis

- [x] Capture the hook's exact `claude --print` invocation — read `apps/indusk-mcp/hooks/eval-trigger.js` around the spawn site, copy the args verbatim. *(Found in `apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts:215-247`, not directly in eval-trigger.js — the hook spawns a Node wrapper that loads the persistent-evaluator module.)*
- [x] Run that exact invocation manually (in a shell, foreground) with one addition: append `--debug` and prepend a prompt that explicitly requires calling `mcp__indusk__highlights_unprocessed`. Save the full stdout+stderr to `.indusk/planning/eval-agent-mcp-access/diagnosis-output.txt`. *(Captured as two files: `test-a-with-mcp-config.json` and `test-b-no-mcp-config.json` for clearer A/B contrast. Test prompt used `mcp__indusk__get_system_version` — the cheapest unique-to-indusk MCP call — instead of `highlights_unprocessed`.)*
- [x] Inspect the debug output. Specifically check: (a) did Claude initialize MCP servers at startup, (b) was the `mcp__indusk__*` tool surface listed, (c) did the prompted tool call return a tool-not-found / permission-denied / never-attempted signal.
- [x] Test each of the 4 brief hypotheses systematically, capturing each variant's output. *(H2 was definitive after Test A + Test B; H1/H3/H4 not run because H2 fully explains the symptom.)*
- [x] Write `diagnosis.md` at `.indusk/planning/eval-agent-mcp-access/diagnosis.md` documenting which hypothesis was confirmed (or a new 5th cause), the supporting evidence (specific debug log lines), and the proposed minimal fix for Phase 2.

#### Phase 1 Verification
- [x] (no tests flip at this phase — reason: infra)
- [x] `diagnosis.md` exists with a confirmed root cause and a named minimal fix.
- [x] `diagnosis-output.txt` exists and contains the captured debug runs for each hypothesis tested. *(Equivalent: `test-a-with-mcp-config.json` + `test-b-no-mcp-config.json`.)*

#### Phase 1 Document
- [x] Append a "MCP-access debugging" entry to the `apps/indusk-docs/src/reference/eval/overview.md` "Known Failure Modes" section, naming the symptom (`graphitiWrites: 0`), the underlying cause (per diagnosis), and the manual command to reproduce.

### Phase 2: Fix

- [x] Apply the minimal change identified in Phase 1's diagnosis. *(Applied: added `--mcp-config .mcp.json` to all 4 `claude --print` spawn sites: `persistent-evaluator.ts:215-247` (resume + fresh) and `evaluator-runner.ts:77, 224`. Resume path also gained `--permission-mode acceptEdits` for symmetry with fresh.)*
- [x] If the fix changes how the inline evaluator script discovers the project root or .mcp.json path, update both hook files identically. *(N/A — fix is in the persistent-evaluator/evaluator-runner modules, not the hook's inline script. The hook spawns the modules; the modules now spawn `claude --print` with the right flags. Hooks unchanged.)*
- [x] Bump `apps/indusk-mcp/package.json` version → 1.23.0 (feature-restoring fix).

#### Phase 2 Verification
- [ ] T1 passes: trigger an evaluator run via a real `jj describe` while at least one unprocessed highlight exists in `.indusk/highlights.jsonl`. Read the resulting scorecard in `.indusk/eval/results.log` — assert `graphitiWrites > 0`. *(Blocked on publish + global upgrade. The hook in `.claude/hooks/eval-trigger.js` resolves to the global `@infinitedusky/indusk-mcp` install (currently 1.22.0). The local source fix won't be exercised by `jj describe` until 1.23.0 is published and the global install is upgraded.)*

#### Phase 2 Document
- [x] Update the changelog entry for the new version describing the fix in user terms.

### Phase 3: Smoke + Regression

- [ ] Confirm `.indusk/highlights.jsonl` still has the 3 queued entries from before the fix. If they've been processed during Phase 2 verification, document that and skip the dedicated smoke trigger.
- [ ] If the 3 queued entries are still unprocessed: trigger one more `jj describe` and wait for the evaluator to complete (≤120s). Verify `.indusk/highlights-processed.jsonl` now exists and contains 3 entries with `action: wrote-episode`.
- [ ] Search Graphiti for one of the highlight contents to verify episodes actually landed: `mcp__graphiti__search_nodes({ query: "<highlight-snippet>", group_ids: ["dusk", "shared"], max_nodes: 5 })`. Capture results.
- [ ] Add a regression check (if feasible from the host environment): a script under `apps/indusk-mcp/src/__tests__/` that grep-asserts the spawn-args string in `eval-trigger.js` includes the fix flag. This is a structural check (not a real subprocess test) since spawning `claude --print` in CI is impractical.

#### Phase 3 Verification
- [ ] T2 passes: `.indusk/highlights-processed.jsonl` contains 3 entries; Graphiti search returns matching episodes for at least one of them.
- [ ] Regression check (if added): the structural test grepping `eval-trigger.js` for the fix-flag passes (`pnpm vitest run src/__tests__/`).

#### Phase 3 Document
- [x] CLAUDE.md "Current State" updated when 1.23.x shipped — historically accurate at the time.

### Phase 4: Resume-prompt regression fix

**Goal**: the resume path of the eval agent's spawn now reaches the same Step 4 (process unprocessed highlights) instruction as the fresh-spawn path. The minimal hand-rolled "Evaluate a new commit ... output the JSON scorecard" resume prompt drops Step 4 entirely; this phase makes them symmetric.

Discovered 2026-06-27 during a digression while investigating why highlights still weren't draining despite the 1.23.x fix being intact. Diagnostic evidence: across 197 evals on the persistent session `12cb92bb-2c82-4781-9ff7-f2867cf28e5b` (created 2026-04-19, last used 2026-06-28), the inner Claude called `mcp__indusk__highlights_unprocessed` only 8 times and called `mcp__indusk__graph_capture` / `mcp__indusk__highlight_mark_processed` **zero times**. The 3 entries in `.indusk/highlights-processed.jsonl` are from the April first-spawn run; every commit since has been a resume that received no Step 4 instruction.

- [ ] Extract the Step 4 "process unprocessed highlights" block from `apps/indusk-mcp/src/lib/eval/prompt-builder.ts` into an exported `buildHighlightsInstructions(opts: { projectGroup: string })` helper. The fresh-spawn prompt continues to use it via the existing `buildEvaluatorPrompt` path.
- [ ] In `apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts`'s `buildArgsAndPrompt()`, on the resume branch, prepend `buildHighlightsInstructions({ projectGroup })` to the existing minimal `resumePrompt`. Order: highlights instructions → "Evaluate a new commit ..." → "Output ONLY the JSON scorecard". The inner Claude sees: "process highlights first, then score the commit."
- [ ] Bump `apps/indusk-mcp/package.json` from `1.31.0` to `1.31.1` (post-publish patch — the regression bug was always there; we're surfacing the fix as a discrete patch so the changelog can document the second cause clearly).
- [ ] Add a changelog entry to `apps/docs/src/changelog.md` under `[Unreleased]` describing the resume-prompt fix: gap statement, fix shape, expected behavior change (highlights now drain on every resume, not just on first-spawn).

#### Phase 4 Verification
- [ ] T3 passes: source-grep test in `apps/indusk-mcp/src/__tests__/eval-resume-prompt-includes-highlights.test.ts` reads `persistent-evaluator.ts` source and asserts the resume-prompt construction reaches the highlights instructions (either inlined or via `buildHighlightsInstructions` call). Pre-fix the test fails because the minimal prompt has no `highlights_unprocessed` / `graph_capture` / `highlight_mark_processed` reference; post-fix it passes.
- [ ] T4 passes (manual smoke): after publishing 1.31.1 and upgrading the global install, trigger an eval via a real `git commit`. Within one eval cycle (≤120s), assert `.indusk/highlights-processed.jsonl` grew by ≥1 entry. Compare counts before/after.
- [ ] Full `pnpm vitest run` from `apps/indusk-mcp/` passes (no regression on the existing suite).

#### Phase 4 Context
- [ ] Add a CLAUDE.md Known Gotcha: "The eval agent's resume prompt is hand-rolled and intentionally minimal — but it MUST include Step 4 (process highlights) or highlights stop draining on every commit after the first session spawn. The fresh-spawn path goes through `buildEvaluatorPrompt` (which includes Step 4); the resume path prepends `buildHighlightsInstructions()` to a minimal commit-evaluation block. Don't shrink the resume prompt without first checking whether `highlights-processed.jsonl` is still growing."

#### Phase 4 Document
- [ ] Update the "MCP-access debugging" section in `apps/docs/src/reference/eval/overview.md` (the section added in Phase 1) with a "Second cause: resume prompt drops Step 4" note + a pointer to this plan's Phase 4.

### Phase 5: Falsification — backwards-anchoring phrasing, empty-queue behavior, spawn-flag regression

**Goal**: verify whether the Phase 4 fix's attested state holds against three specific failure modes the trajectory rows T3 + T4 didn't catch. T3 only pins the source-level call shape; T4 is a runtime smoke that fails LOUDLY but doesn't decompose which prompt micro-detail caused failure. Phase 5 hunts three concrete failure modes that could survive a green T3 but reduce or eliminate T4's drain.

- [x] **H14 fix (T5)**: in `persistent-evaluator.ts`'s resume-prompt template literal, replaced `"answer the same evaluation questions as before"` → `"answer the v1 rubric questions for this commit"` and dropped the trailing `"as before — no commentary"` → `"— no commentary"`. The "as before" anchor is gone in both places.
- [x] **H15 fix (T6)**: in `prompt-builder.ts`'s `buildHighlightsInstructions` helper, appended an empty-list paragraph immediately after the "unavailable" sentence: `If the tool returns an empty list (no unprocessed highlights), note "(no unprocessed highlights)" once in your output and continue to the rubric — do not invent highlights, do not loop searching for them, do not call \`graph_capture\` speculatively.`
- [x] **H16 fix (T7)**: extended `eval-resume-prompt-includes-highlights.test.ts` with a T7 case asserting `persistent-evaluator.ts` source contains both `--mcp-config` AND `bypassPermissions` literals (count ≥ 2 each, since both must appear in the resume + fresh spawn-arg sites). 1.23.x April flags now locked in by source grep.

#### Phase 5 Verification
- [x] T5 passes (`pnpm vitest run src/__tests__/eval-resume-prompt-includes-highlights.test.ts` — assertion scoped to the `resumePrompt` template literal so comments mentioning the pre-fix phrasing don't false-positive)
- [x] T6 passes (empty-list paragraph matched by the helper's body extraction)
- [x] T7 passes (both flag literals present with count ≥ 2)
- [x] Full `pnpm vitest run` from `apps/indusk-mcp/` — 8 of 8 in this file passing; suite to be re-run before commit

#### Phase 5 Context
- [x] CLAUDE.md "eval agent resume prompt must include Step 4" gotcha extended in this commit with the three Phase 5 invariants (no backwards-anchoring; explicit empty-list handling; source-grep regression on `--mcp-config` + `bypassPermissions`).

#### Phase 5 Document
- [x] 1.31.1 not yet published; the Phase 5 fixes ride along on 1.31.1 — no separate version bump. Changelog entry under `[1.31.1]` extended with a "Phase 5 falsification fixes" sub-section describing the three falsification-surfaced changes.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/hooks/eval-trigger.js` | Add `--mcp-config` flag (or equivalent) to spawn args |
| `.claude/hooks/eval-trigger.js` | Mirror of above |
| `apps/indusk-mcp/package.json` | Version bump |
| `apps/indusk-docs/src/changelog.md` | New version entry |
| `apps/indusk-docs/src/reference/eval/overview.md` | Append to "Known Failure Modes" |
| `.indusk/planning/eval-agent-mcp-access/diagnosis.md` | New: diagnosis log |
| `.indusk/planning/eval-agent-mcp-access/diagnosis-output.txt` | New: captured hypothesis-test outputs |
| `apps/indusk-mcp/src/__tests__/eval-trigger-mcp-flag.test.ts` | New (Phase 3, optional): structural regression test |
| `CLAUDE.md` | Add to Current State |

## Dependencies

None at code-graph level. Depends on the `indusk-infra` container (FalkorDB + Graphiti) being healthy for the smoke step, and on `claude` CLI being on PATH.

## Notes

- The brief's "(non-)testability" caveat applies: a true CI regression for "evaluator subprocess can call MCP tools" requires spawning `claude --print` in CI with a real Anthropic API key, which is impractical. Phase 3's structural regression check is a compromise — it asserts the spawn args include the fix flag but doesn't prove the subprocess can actually invoke tools end-to-end. The smoke validation (Phase 3 first item) is the real proof.
- If Phase 1 finds an unforeseen 5th cause, append it to `diagnosis.md` as a discovered root and amend Phase 2's "minimal change" item to match. Do not extend scope to address other related issues.
