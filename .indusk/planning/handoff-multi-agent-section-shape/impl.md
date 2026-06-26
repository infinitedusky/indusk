---
title: "handoff-multi-agent section shape — Impl"
date: 2026-06-26
status: approved
trajectory: required
rationale: required
gate_policy: ask
---

# handoff-multi-agent section shape — Impl

## Goal

Reshape `.indusk/current.md` from fixed sections + separate `.indusk/agents/` presence files into a single file with per-agent sections, plus give the agent a real explicit write surface (`mcp__indusk__update_current_section`). Bring `/handoff` back from deprecation as a real session-end ritual. Land before 1.29.0 publishes so consumers never see the wrong shape.

## Scope

### In Scope
- New `apps/indusk-mcp/src/lib/agents/current-md.ts` — parse/serialize/upsert/remove/prune section helpers.
- New MCP tool `mcp__indusk__update_current_section` taking `{ sessionId, task, sections: { in_flight, open_questions, cursor } }`.
- Repurpose `apps/indusk-mcp/src/bin/commands/agent.ts`: `register`/`done`/`list`/`prune` operate on sections in `current.md` instead of files in `.indusk/agents/`.
- Rewrite `apps/indusk-mcp/skills/handoff.md` from deprecation pointer to a real ritual: find own section by session ID → call MCP tool to overwrite → commit → fire eval-trigger.
- Rewrite `apps/indusk-mcp/skills/catchup.md` to read sections from `current.md` (drop `.indusk/agents/` glob).
- New `apps/indusk-mcp/templates/current.md` shape with `Project (shared)` anchor section.
- Update `init.ts` (just uses new template) and `update.ts` step 7c (migrates the file if still empty template).
- Update parent ADR `.indusk/planning/handoff-multi-agent/adr.md` Alternatives + Decision sections.
- Update docs: `apps/docs/src/guide/multi-agent.md`, `apps/docs/src/reference/cli/agent.md`, `apps/docs/src/reference/skills/{catchup,handoff}.md`, `apps/docs/src/decisions/multi-agent-coordination.md`, `apps/docs/src/changelog.md`.
- Update CLAUDE.md Architecture + Conventions + Current State entries that reference the old shape.

### Out of Scope
- Auto-trigger / forced-reflection mechanism (mid-session prompts to update sections). Per the brief — first version is "agent writes when it judges to write."
- Per-section ACLs, signed sections, or any cross-agent trust enforcement.
- Cross-machine bulletin sync. Same scope as parent plan.
- Removing the `.indusk/agents/` directory line from `GITIGNORE_ENTRIES`. Kept as a precaution; the directory just won't be created.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `apps/indusk-mcp/src/lib/agents/current-md.ts` (parse/serialize/upsertSection/removeSection/pruneStaleSections/listSections); new MCP tool `update_current_section`; comprehensive unit tests | `lib/agents/session.ts` (session ID resolution + sanitizer from parent plan); `lib/config.ts` (TTL) |
| Phase 2 | Rewritten `apps/indusk-mcp/src/bin/commands/agent.ts` — register/done/list/prune operate on sections via Phase 1 lib; updated `multi-agent-cli.test.ts` | Phase 1 lib |
| Phase 3 | Rewritten `apps/indusk-mcp/skills/handoff.md` (deprecation → real ritual) and `catchup.md` (read sections from current.md); manual sync to dusk's `.claude/skills/`; updated `multi-agent-skills.test.ts` | Phase 1 lib + Phase 2 CLI |
| Phase 4 | New `apps/indusk-mcp/templates/current.md` shape; `init.ts` uses it (no code change needed); `update.ts` step 7c migrates empty-template files; `multi-agent-init.test.ts` updated | Phase 1 lib (for migration logic) |
| Phase 5 | Parent ADR updated; docs (guide + CLI ref + skill refs + decisions + changelog); CLAUDE.md updates; new e2e test for concurrent-handoff merge (A6); manual smoke procedure updated | Phases 1-4 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | After an agent runs handoff, only its own section in `.indusk/current.md` has changed — other agents' sections are byte-identical before vs after. | Phase 1 | Phase 1 | planned |
| T2 | When an agent's session ID has no matching section in `current.md` and it runs handoff, a new section is appended tagged with its session ID. | Phase 1 | Phase 1 | planned |
| T3 | A new agent's catchup output lists every fresh session present in `current.md` (other agents working on the project), with their tasks. | Phase 0 | Phase 3 | planned |
| T4 | Any agent can edit the `Project (shared)` section without changing any session-owned section. | Phase 1 | Phase 1 | planned |
| T5 | The agent updates its in-flight / open-questions / cursor content via a single structured MCP tool call. | Phase 1 | Phase 1 | planned |
| T6 | Two agents on different branches both run handoff; merging both branches to main produces no merge conflict because they touched different sections. | Phase 0 | Phase 5 | planned |
| T7 | `indusk agent done` removes only the calling agent's section from `current.md`; other sections survive. | Phase 1 | Phase 2 | planned |
| T8 | `indusk agent prune` removes sections whose `Last updated` timestamp is older than `agents.stale_ttl_minutes`; fresh sections survive. | Phase 1 | Phase 2 | planned |
| T9 | Fresh `indusk init` creates `current.md` containing a `Project (shared)` section and no session sections. | Phase 0 | Phase 4 | planned |
| T10 | Running `indusk update` on a pre-section-shape project migrates the template if it's still the empty version from the previous plan; if the user has edited it, the content is preserved untouched. | Phase 0 | Phase 4 | planned |
| T11 | Running `/catchup` does not modify any file (other than the agent's own section if it explicitly calls the MCP tool — catchup itself is read-only). | Phase 0 | Phase 3 | planned |
| T12 | A session ID containing path-traversal characters cannot cause section writes or removals to escape `.indusk/current.md`. | Phase 0 | Phase 2 | planned |
| T13 | A teammate cloning the project sees no leftover session sections from the original developer's machine. | Phase 0 | Phase 4 | planned |

### Deferred Verification

- **U1 — working agents actually call the update_current_section MCP tool at meaningful moments**
  - reason: depends on agent reasoning + skill discipline; non-deterministic; no test can prove "the agent did the right thing."
  - would require: behavioral observation across many real Claude Code sessions, or a forced-trigger mechanism (out of scope per brief).
  - mitigation: feedback signal — Sandy uses the system daily; sessions where the tool should have been called and wasn't become a retrospective lesson. If the gap is consistent, a follow-up plan adds the trigger discipline (skill instruction in `/work` to call the tool at phase boundaries, or a Stop hook that prompts).

### Trajectory Rationale

Phase 0 is the writable baseline. Phase 1+ rows below:

- **T1** `Writable at: Phase 1` — Test imports `upsertSection` and `parseCurrentMd` from `apps/indusk-mcp/src/lib/agents/current-md.ts`. Module does not exist today; the test file is a compile error against the current source.
- **T2** `Writable at: Phase 1` — Same module as T1; tests the append-if-missing branch of `upsertSection`.
- **T4** `Writable at: Phase 1` — Tests editing the `Project (shared)` anchor section, which requires the `editSharedSection` helper in the same Phase 1 module.
- **T5** `Writable at: Phase 1` — Subject is the `mcp__indusk__update_current_section` MCP tool, registered in Phase 1's MCP wiring. No tool exists today; the test's MCP-call import target is absent.
- **T7** `Writable at: Phase 1` — Tests `removeSection` from the Phase 1 lib module. Different `Passes at` (Phase 2) because the user-visible behavior depends on the CLI calling the lib, which lands in Phase 2.
- **T8** `Writable at: Phase 1` — Tests `pruneStaleSections` from the Phase 1 lib module. `Passes at` Phase 2 for the same reason as T7.

## Checklist

### Phase 1: Section lib + MCP write tool

- [ ] Create `apps/indusk-mcp/src/lib/agents/current-md.ts` with these exports:
  ```typescript
  export interface AgentSection {
    sessionId: string;        // full UUID
    sessionShort: string;     // first 8 chars of UUID
    task: string;
    lastUpdated: string;      // ISO timestamp
    inFlight: string;         // markdown body of ### In Flight
    openQuestions: string;    // markdown body of ### Open Questions
    cursor: string;           // markdown body of ### Cursor
  }
  export interface CurrentMd {
    sharedSection: string;    // markdown body of ## Project (shared)
    sections: AgentSection[]; // per-agent sections in file order
  }
  export function parseCurrentMd(content: string): CurrentMd;
  export function serializeCurrentMd(doc: CurrentMd): string;
  export function upsertSection(content: string, section: AgentSection): string;
  export function removeSection(content: string, sessionId: string): string;
  export function editSharedSection(content: string, sharedBody: string): string;
  export function pruneStaleSections(content: string, ttlMinutes: number, now?: Date): string;
  export function listSections(content: string, ttlMinutes: number, now?: Date): { fresh: AgentSection[]; stale: AgentSection[] };
  ```
- [ ] Section heading shape: `## Session <short8> — <task>`. Inside the section, `**Session ID**: <full-uuid>` line drives unambiguous matching by full ID. Lookup priority: full-UUID match first, short-prefix fallback (warning on multiple matches).
- [ ] Wire new MCP tool `update_current_section` in `apps/indusk-mcp/src/mcp/index.ts` (or wherever tools live). Input shape:
  ```typescript
  {
    sessionId: string;
    task: string;
    sections: {
      in_flight: string;
      open_questions: string;
      cursor: string;
    };
  }
  ```
  Tool reads `.indusk/current.md`, calls `upsertSection` with the given session, writes back atomically (write to temp + rename).
- [ ] Reuse `sanitizeSessionId` from `lib/agents/session.ts` — every section-mutating function routes sessionId through it.
- [ ] Vitest unit tests in `apps/indusk-mcp/src/lib/agents/__tests__/current-md.test.ts`:
  - parse round-trip (parse → serialize → byte-equal to canonical form)
  - upsert: T1 (only-touch-own), T2 (append-if-missing)
  - removeSection: T7 (other sections survive)
  - editSharedSection: T4 (no session-owned sections change)
  - pruneStaleSections: T8 (timestamp-based filter)
  - listSections: returns fresh + stale partition
  - sanitizer regression: T12 (path-traversal session ID rejected at lib boundary)
- [ ] Vitest unit tests for the MCP tool itself: T5 (the tool call is the documented input/output, atomic read-modify-write).

#### Phase 1 Verification
- [ ] T1 passes — `pnpm --filter @infinitedusky/indusk-mcp test src/lib/agents/__tests__/current-md.test.ts`
- [ ] T2 passes (same file)
- [ ] T4 passes (same file)
- [ ] T5 passes — MCP tool wrapper test
- [ ] T7 lib-level passes (CLI-level still red until Phase 2)
- [ ] T8 lib-level passes (CLI-level still red until Phase 2)
- [ ] T12 passes (sanitizer regression at the new lib boundary)

#### Phase 1 Context
- [ ] Update `CLAUDE.md` Known Gotchas: add an entry describing the section-shape contract — heading format, full-UUID matching, atomic-write requirement, sanitization at every entry.

#### Phase 1 Document
- [ ] Update `apps/docs/src/reference/tools/indusk-mcp.md` (the InDusk MCP tool catalog) — add `update_current_section` to the tool list with shape + behavior. This is the new public MCP surface; the user-facing CLI reference change waits for Phase 2.

### Phase 2: Repurpose `indusk agent` CLI for sections

- [ ] Rewrite `apps/indusk-mcp/src/bin/commands/agent.ts`:
  - `register --task "..."` calls `upsertSection` with empty body sections (just establishes presence).
  - `done` calls `removeSection` with the current session ID.
  - `list` calls `listSections(content, ttl)` and prints the `fresh` partition as a compact table — same output shape as today's bulletin.
  - `prune` calls `pruneStaleSections` and reports what was removed.
- [ ] Drop the `.indusk/agents/` directory writes from `register`. The directory just stops being used. Gitignore line stays.
- [ ] Drop `serializePresenceFile` / `parsePresenceFile` / `readBulletin` from the file — replaced by lib calls.
- [ ] Keep `currentBranch(cwd)` for the section's optional branch metadata (still useful, just lives inside the section now, not in a frontmatter).
- [ ] Rewrite `multi-agent-cli.test.ts`:
  - T3 / T4 / T5 / T7 / T8 (the live CLI assertions) update to expect section-shape outcomes.
  - T12 (path-traversal) keeps the same end-to-end shape but now asserts no escape via section mutations.
  - Add a supporting test: heartbeat-via-list still works (calling `list` from session A re-stamps A's `Last updated`).

#### Phase 2 Verification
- [ ] T7 passes end-to-end — `vitest run src/__tests__/multi-agent-cli.test.ts` shows `agent done` removes only the calling session's section.
- [ ] T8 passes end-to-end — backdated section is filtered from `agent list` output; `agent prune` removes it.
- [ ] T12 passes end-to-end — poisoned session ID returns non-zero with sanitizer error before any section write.

#### Phase 2 Context
- [ ] Update `CLAUDE.md` Architecture entry for indusk-mcp's `agent` subcommand — describe the new shape ("agent CLI operates on sections in `.indusk/current.md`"), drop the obsolete `.indusk/agents/{sessionId}.md` reference.

#### Phase 2 Document
- [ ] Update `apps/docs/src/reference/cli/agent.md` — rewrite the body so the four subcommands describe section operations. Drop the "File shape" section about presence files; add a new "Section shape" section with the `## Session <short> — <task>` template. Cross-link to the multi-agent guide.

### Phase 3: Skill rewrites — handoff resurrected, catchup reads sections

- [ ] Rewrite `apps/indusk-mcp/skills/handoff.md`:
  - Replace deprecation page with a real ritual: (1) call `mcp__indusk__update_current_section` with the session's current in-flight / open-questions / cursor, (2) commit the change, (3) `indusk agent done` optional (sections age out naturally), (4) fire eval-trigger.
  - Heading reflects the new role: not "Deprecated," but "Session-end ritual."
  - Explicit guidance: the agent fills in the three sections in its own words. No required schema beyond the three categories.
- [ ] Rewrite `apps/indusk-mcp/skills/catchup.md`:
  - Strip the `.indusk/agents/` glob step.
  - Update Step 3 from "read `.indusk/current.md` for operational state" to "read `.indusk/current.md` — surface the `Project (shared)` section and list other agents' sessions from per-agent sections."
  - Keep the pure-read invariant explicit.
- [ ] Sync rewritten skills to dusk's `.claude/skills/catchup/SKILL.md` and `.claude/skills/handoff/SKILL.md` for this-session effect (the standard `globSync("*.md")` in init/update reaffirms from source on next update).
- [ ] Rewrite `multi-agent-skills.test.ts`:
  - T3: catchup skill content instructs reading `current.md` sections and surfacing other agents from them. No `.indusk/agents/` references.
  - T11: pure-read invariant — catchup skill body explicitly disclaims any file write outside the agent's own MCP tool call.
  - Drop the "handoff is deprecated" content assertion; replace with: handoff skill instructs calling `mcp__indusk__update_current_section` and committing.

#### Phase 3 Verification
- [ ] T3 passes — content assertion on catchup skill confirms section-read flow.
- [ ] T11 passes — pure-read invariant content assertion.
- [ ] (No test flips at this phase from the CLI-level work — Phase 2 covered those; this phase covers skill content + the catchup-reads-current flow.)

#### Phase 3 Context
- [ ] Update `CLAUDE.md` Conventions entry that currently says "`/catchup` is pure-read + presence-register; `/handoff` is deprecated" — replace with the new shape: `/catchup` reads `current.md` sections; `/handoff` is a real session-end ritual that calls `mcp__indusk__update_current_section`.

#### Phase 3 Document
- [ ] Update `apps/docs/src/reference/skills/catchup.md` — describe the section-read flow.
- [ ] Update `apps/docs/src/reference/skills/handoff.md` — flip from deprecation page to the real ritual page. Preserve the URL for backward links.

### Phase 4: Template + init/update migration

- [ ] Rewrite `apps/indusk-mcp/templates/current.md` to the new shape:
  ```markdown
  # Operational State

  This file represents the operational state for the project — what's
  happening RIGHT NOW. Each Claude Code session owns its own section
  below; the `Project (shared)` section is for cross-cutting state that
  doesn't belong to a single session.

  Working agents update their sections via `mcp__indusk__update_current_section`
  (typically at `/handoff`). `/catchup` reads this file pure-read.

  ## Project (shared)

  _Any agent can edit this section. Cross-cutting state that's true for
  the whole project right now._

  (empty)

  ---

  <!-- session sections are appended below this marker by `update_current_section` -->
  ```
- [ ] `init.ts` — no code change required. Template is at `apps/indusk-mcp/templates/current.md`; init's existing step 3.5 already copies it.
- [ ] `update.ts` step 7c — extend the existing migration:
  - If `.indusk/current.md` doesn't exist, copy template (unchanged behavior).
  - If `.indusk/current.md` exists AND is byte-equal to the PARENT plan's empty template (the old shape we shipped on the branch), replace with the new template.
  - If `.indusk/current.md` exists and has any user-authored content, leave untouched.
  - To detect "byte-equal to old empty template," embed a known SHA-256 of the parent template content as a constant; compare on read.
- [ ] Update `multi-agent-init.test.ts`:
  - T9: fresh init creates new-shape template (has `## Project (shared)` heading).
  - T10: pre-section-shape project gets migrated only if file is still empty template.
  - T10 supporting: pre-section-shape project with user content gets preserved.
  - T13: still asserts the gitignore line for `.indusk/agents/` lands (kept as precaution).

#### Phase 4 Verification
- [ ] T9 passes — fresh init's `current.md` matches the new template shape.
- [ ] T10 passes — update migrates empty template, preserves user-edited content.
- [ ] T13 passes — gitignore line still present.

#### Phase 4 Context
- [ ] Update `CLAUDE.md` Conventions entry that describes `.indusk/current.md` — describe the per-agent section shape with the `Project (shared)` anchor; drop the "fixed sections (In Flight / Open Questions / Cursor at top level)" wording.

#### Phase 4 Document
- [ ] Update `apps/docs/src/guide/multi-agent.md` — rewrite the operational-vs-architectural table and the day-in-the-life flows for the section shape. Update the Mermaid sequence diagram so the FS messages reference `current.md` section edits, not `.indusk/agents/` writes. Update the state diagram or replace it with a section-staleness diagram (Fresh / Stale / Removed).

### Phase 5: Parent ADR + docs + changelog + concurrent-handoff e2e

- [ ] Update `.indusk/planning/handoff-multi-agent/adr.md`:
  - `Decision` section: replace primitive (2) (`.indusk/current.md` as fixed-sections file) with the per-agent-section shape. Replace primitive (3) (`.indusk/agents/<sessionId>.md` per-session presence file) with "sections in current.md double as presence."
  - `Alternatives Considered`: add a new entry for the fixed-sections + separate-presence shape we originally shipped, with the rejection reason (write-side gap + factoring didn't match user's model). Update the rejected lock-and-snapshot wording so it doesn't read as the only rejected single-file design.
  - Append a `## Supersedes` clause referencing `.indusk/planning/handoff-multi-agent-section-shape/`.
- [ ] Update `apps/docs/src/decisions/multi-agent-coordination.md` — propagate the ADR changes to the docs site copy.
- [ ] Update `apps/docs/src/changelog.md` — rewrite the 1.29.0 entry to describe the section shape and the explicit MCP write surface. The old entry described the wrong shape; replace, don't append.
- [ ] Update `CLAUDE.md` Key Decisions one-liner for `handoff-multi-agent` — describe the section shape; reference the section-shape plan path.
- [ ] Update `CLAUDE.md` Current State entry for `handoff-multi-agent` — note that the section-shape rework replaced the original factoring before publish.
- [ ] Add e2e test for T6 (concurrent-handoff merge):
  - Test fixture: tmp project with two worktrees on two branches.
  - Each worktree runs `mcp__indusk__update_current_section` (or the CLI equivalent) with a distinct session ID + task. Commits.
  - Attempt merge of both branches into main.
  - Assert: no merge conflict, both sections present in main's `current.md`.
  - If git's auto-merge produces a conflict despite section boundaries, the test fails — signals we need clearer section delimiters (e.g., `<!-- session-start: <uuid> -->` markers).
- [ ] Update `apps/indusk-mcp/test-fixtures/multi-agent-manual-smoke.md` for the new shape. Steps describe section-overwrite behavior + concurrent-handoff visibility.
- [ ] Update Mermaid diagrams in `apps/docs/src/guide/multi-agent.md` (sequence + state).

#### Phase 5 Verification
- [ ] T6 passes — e2e merge test confirms two concurrent handoffs on different worktrees produce no conflict.
- [ ] Full multi-agent test sweep (all 13 trajectory tests + regression) green.

#### Phase 5 Context
- [ ] Update `CLAUDE.md` Current State section: append a paragraph describing the section-shape rework (preceded by the `handoff-multi-agent` summary that's already there).

#### Phase 5 Document
- [ ] Update changelog 1.29.0 entry with the final shape (this replaces the old entry, since 1.29.0 hasn't published yet).
- [ ] Confirm all docs cross-links resolve and Mermaid diagrams render.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/agents/current-md.ts` | New — parse / serialize / upsert / remove / edit-shared / prune / list |
| `apps/indusk-mcp/src/lib/agents/__tests__/current-md.test.ts` | New — Phase 1 lib tests |
| `apps/indusk-mcp/src/mcp/...` (wherever tools live) | New `update_current_section` tool wiring |
| `apps/indusk-mcp/src/bin/commands/agent.ts` | Rewritten — operates on sections via Phase 1 lib |
| `apps/indusk-mcp/src/__tests__/multi-agent-cli.test.ts` | Updated — assertions reflect section behavior |
| `apps/indusk-mcp/skills/handoff.md` | Rewritten — deprecation → real ritual |
| `apps/indusk-mcp/skills/catchup.md` | Rewritten — drop agents/ glob, read sections |
| `apps/indusk-mcp/src/__tests__/multi-agent-skills.test.ts` | Updated — new content assertions |
| `apps/indusk-mcp/templates/current.md` | Rewritten — per-agent-section shape |
| `apps/indusk-mcp/src/bin/commands/update.ts` | Modified — step 7c migrates empty old template |
| `apps/indusk-mcp/src/__tests__/multi-agent-init.test.ts` | Updated — new template + migration cases |
| `apps/indusk-mcp/src/__tests__/multi-agent-e2e.test.ts` | Updated + new T6 merge case |
| `apps/indusk-mcp/test-fixtures/multi-agent-manual-smoke.md` | Updated — section-overwrite procedure |
| `.indusk/planning/handoff-multi-agent/adr.md` | Updated — Decision + Alternatives + Supersedes |
| `apps/docs/src/decisions/multi-agent-coordination.md` | Updated — propagated from parent ADR |
| `apps/docs/src/guide/multi-agent.md` | Rewritten — section shape, new diagrams |
| `apps/docs/src/reference/cli/agent.md` | Rewritten — section ops, drop presence-file references |
| `apps/docs/src/reference/skills/catchup.md` | Updated — section-read flow |
| `apps/docs/src/reference/skills/handoff.md` | Rewritten — real ritual page |
| `apps/docs/src/reference/tools/indusk-mcp.md` | Updated — add `update_current_section` |
| `apps/docs/src/changelog.md` | Updated — 1.29.0 entry rewritten |
| `CLAUDE.md` | Updated — Architecture, Conventions, Key Decisions, Current State, Known Gotchas |

## Dependencies

- Parent plan `.indusk/planning/handoff-multi-agent/` impl-complete (yes, status: completed).
- `lib/agents/session.ts` + `sanitizeSessionId` from parent plan (yes, shipped).
- `lib/config.ts` `readConfig` for TTL lookup (yes).
- 1.29.0 publish blocked on this plan completing.

## Notes

- The new branch off `plan/handoff-multi-agent-phase-1` is `plan/handoff-multi-agent-section-shape`. All work in this plan commits there.
- The MCP tool name `update_current_section` is a placeholder — if a better name surfaces during impl (e.g., `update_my_section`, `promote_to_current`), revise here and in all consumers.
- Atomic write in the MCP tool: write to `current.md.tmp.<sessionId>`, fsync, rename. Same pattern used elsewhere in indusk-mcp.
- Section delimiter: the impl uses `---` horizontal rules between sections + the `## Session <short> — <task>` heading as the section start. If T6's e2e merge test fails with cross-section conflicts, escalate to invisible HTML-comment markers (`<!-- session-start: <uuid> -->` / `<!-- session-end: <uuid> -->`) for unambiguous boundaries.
- The MCP tool's input schema deliberately keeps the three section bodies as plain markdown strings — no nested structure. Lets the agent be expressive without forcing a schema. Validation is "is the body string?" not "does it match a fixed nested structure?"
- Drop the `.indusk/agents/` directory creation from `agent register`, but keep the gitignore line as a precaution. Cheap safety net if anything writes there during the transition.
