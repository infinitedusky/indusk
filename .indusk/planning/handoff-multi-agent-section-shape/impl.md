---
title: "handoff-multi-agent section shape — Impl"
date: 2026-06-26
status: in-progress
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
| T1 | After an agent runs handoff, only its own section in `.indusk/current.md` has changed — other agents' sections are byte-identical before vs after. | Phase 1 | Phase 1 | passing |
| T2 | When an agent's session ID has no matching section in `current.md` and it runs handoff, a new section is appended tagged with its session ID. | Phase 1 | Phase 1 | passing |
| T3 | A new agent's catchup output lists every fresh session present in `current.md` (other agents working on the project), with their tasks. | Phase 0 | Phase 3 | passing |
| T4 | Any agent can edit the `Project (shared)` section without changing any session-owned section. | Phase 1 | Phase 1 | passing |
| T5 | The agent updates its in-flight / open-questions / cursor content via a single structured MCP tool call. | Phase 1 | Phase 1 | passing |
| T6 | Two agents on different branches both run handoff; merging both branches to main produces no merge conflict because they touched different sections. | Phase 0 | Phase 5 | passing |
| T7 | `indusk agent done` removes only the calling agent's section from `current.md`; other sections survive. | Phase 1 | Phase 2 | passing |
| T8 | `indusk agent prune` removes sections whose `Last updated` timestamp is older than `agents.stale_ttl_minutes`; fresh sections survive. | Phase 1 | Phase 2 | passing |
| T9 | Fresh `indusk init` creates `current.md` containing a `Project (shared)` section and no session sections. | Phase 0 | Phase 4 | passing |
| T10 | Running `indusk update` on a pre-section-shape project migrates the template if it's still the empty version from the previous plan; if the user has edited it, the content is preserved untouched. | Phase 0 | Phase 4 | passing |
| T11 | Running `/catchup` does not modify any file (other than the agent's own section if it explicitly calls the MCP tool — catchup itself is read-only). | Phase 0 | Phase 3 | passing |
| T12 | A session ID containing path-traversal characters cannot cause section writes or removals to escape `.indusk/current.md`. | Phase 0 | Phase 2 | passing |
| T13 | A teammate cloning the project sees no leftover session sections from the original developer's machine. | Phase 0 | Phase 4 | passing |
| T14 | A section body (in_flight / open_questions / cursor) containing `---\n## Session <fake-id> — <fake-task>` does not cause a fake session to appear in `agent list` output or in any other consumer's parse of `current.md`. | Phase 0 | Phase 6 | written |
| T15 | Two concurrent CLI processes calling `agent register` with different session IDs against the same `current.md` always result in both sections being present after both processes exit (no read-modify-write data loss). | Phase 0 | Phase 6 | written |
| T16 | `/catchup` does not surface stale per-agent sections (sections whose `Last updated` is older than `agents.stale_ttl_minutes`) as if they were active working agents. | Phase 0 | Phase 6 | written |
| T17 | A `CLAUDE_CODE_SESSION_ID` value containing a newline or other control character is rejected by `sanitizeSessionId` rather than silently corrupting `current.md` on serialize. | Phase 0 | Phase 6 | written |

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

- [x] Create `apps/indusk-mcp/src/lib/agents/current-md.ts` with these exports:
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
- [x] Section heading shape: `## Session <short8> — <task>`. Inside the section, `**Session ID**: <full-uuid>` line drives unambiguous matching by full ID. Lookup priority: full-UUID match first, short-prefix fallback (warning on multiple matches). **Done — matching is by full UUID via parser's `**Session ID**:` regex. Short prefix is heading-only for human legibility; collisions tolerated because full UUID disambiguates.**
- [x] Wire new MCP tool `update_current_section` in `apps/indusk-mcp/src/mcp/index.ts` (or wherever tools live). Input shape:
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
  Tool reads `.indusk/current.md`, calls `upsertSection` with the given session, writes back atomically (write to temp + rename). **Done — `registerAgentTools` in `apps/indusk-mcp/src/tools/agent-tools.ts`; wired in `src/server/index.ts` alongside the other tool registrations. Atomic write via tmp + renameSync.**
- [x] Reuse `sanitizeSessionId` from `lib/agents/session.ts` — every section-mutating function routes sessionId through it. **Done — `upsertSection` and `removeSection` both call `sanitizeSessionId`; rejected IDs throw TypeError before any string mutation.**
- [x] Vitest unit tests in `apps/indusk-mcp/src/lib/agents/__tests__/current-md.test.ts`:
  - parse round-trip (parse → serialize → byte-equal to canonical form)
  - upsert: T1 (only-touch-own), T2 (append-if-missing)
  - removeSection: T7 (other sections survive)
  - editSharedSection: T4 (no session-owned sections change)
  - pruneStaleSections: T8 (timestamp-based filter)
  - listSections: returns fresh + stale partition
  - sanitizer regression: T12 (path-traversal session ID rejected at lib boundary) **Done — 18 passing cases in `current-md.test.ts`: roundtrip, T1 (two sub-cases), T2 (three sub-cases including sanitizer regression), T4 (two sub-cases), T7-lib (three sub-cases including sanitizer regression), T8-lib (three sub-cases), listSections partition.**
- [x] Vitest unit tests for the MCP tool itself: T5 (the tool call is the documented input/output, atomic read-modify-write). **Done — 5 passing cases in `agent-tools.test.ts`: registration, create-from-empty, upsert-in-place, preserve-others, sanitizer-regression.**

#### Phase 1 Verification
- [x] T1 passes — `pnpm --filter @infinitedusky/indusk-mcp test src/lib/agents/__tests__/current-md.test.ts` **Verified 2026-06-26: 18 of 18 lib cases passing.**
- [x] T2 passes (same file) **Verified — three sub-cases including append-on-empty + append-alongside + sanitizer regression.**
- [x] T4 passes (same file) **Verified — two sub-cases.**
- [x] T5 passes — MCP tool wrapper test **Verified — 5 of 5 in `agent-tools.test.ts`.**
- [x] T7 lib-level passes (CLI-level still red until Phase 2) **Verified — `removeSection` tests passing; CLI-level test stays red until Phase 2 wires the CLI.**
- [x] T8 lib-level passes (CLI-level still red until Phase 2) **Verified — `pruneStaleSections` tests passing.**
- [x] T12 passes (sanitizer regression at the new lib boundary) **Verified — sanitizer regression tests in both `upsertSection` and `removeSection` confirm path-traversal rejection.**

#### Phase 1 Context
- [x] Update `CLAUDE.md` Known Gotchas: add an entry describing the section-shape contract — heading format, full-UUID matching, atomic-write requirement, sanitization at every entry. **Done — entry covers file shape, full-UUID matching invariant, split-and-slice parser rationale (JS regex limitation), MCP tool location + input shape + atomic-write, and the malformed-timestamp-is-kept policy.**

#### Phase 1 Document
- [x] Update `apps/docs/src/reference/tools/indusk-mcp.md` (the InDusk MCP tool catalog) — add `update_current_section` to the tool list with shape + behavior. This is the new public MCP surface; the user-facing CLI reference change waits for Phase 2. **Done — new `### Agent Tools` section added with the tool's input shape, behavior summary, and cross-link to the multi-agent ADR.**

### Phase 2: Repurpose `indusk agent` CLI for sections

- [x] Rewrite `apps/indusk-mcp/src/bin/commands/agent.ts`:
  - `register --task "..."` calls `upsertSection` with empty body sections (just establishes presence).
  - `done` calls `removeSection` with the current session ID.
  - `list` calls `listSections(content, ttl)` and prints the `fresh` partition as a compact table — same output shape as today's bulletin.
  - `prune` calls `pruneStaleSections` and reports what was removed. **Done — full rewrite to use the Phase 1 lib. `register` preserves existing section bodies if a section already exists (just refreshes Last updated + task). `list` self-heartbeats the caller's own section (preserves parent plan's heartbeat semantics). `prune` reports the count from `listSections`.**
- [x] Drop the `.indusk/agents/` directory writes from `register`. The directory just stops being used. Gitignore line stays. **Done — no code path writes to `.indusk/agents/` anymore. Gitignore line untouched (still in init's GITIGNORE_ENTRIES as a precaution).**
- [x] Drop `serializePresenceFile` / `parsePresenceFile` / `readBulletin` from the file — replaced by lib calls. **Done — gone. The CLI is a thin shell over current-md.ts helpers + atomic-write.**
- [x] Keep `currentBranch(cwd)` for the section's optional branch metadata (still useful, just lives inside the section now, not in a frontmatter). **Kept — currently unused-but-noted; sections don't store branch yet. Will surface in catchup output in Phase 3 if needed.**
- [x] Rewrite `multi-agent-cli.test.ts`:
  - T3 / T4 / T5 / T7 / T8 (the live CLI assertions) update to expect section-shape outcomes.
  - T12 (path-traversal) keeps the same end-to-end shape but now asserts no escape via section mutations.
  - Add a supporting test: heartbeat-via-list still works (calling `list` from session A re-stamps A's `Last updated`). **Done — full rewrite. 9 passing cases covering T3-CLI, T7, T8 + supporting prune, empty list, silent-done, T12 + supporting --session-id and normal-UUID. T1/T2 stay `.skip()` until Phase 3. Stale TTL test uses a different session-ID for the observer call to avoid self-heartbeat masking the stale state.**

#### Phase 2 Verification
- [x] T7 passes end-to-end — `vitest run src/__tests__/multi-agent-cli.test.ts` shows `agent done` removes only the calling session's section. **Verified — done call removes the section; subsequent list reports no agents.**
- [x] T8 passes end-to-end — backdated section is filtered from `agent list` output; `agent prune` removes it. **Verified — observer-from-different-session sees the stale section filtered out; prune call removes it from current.md.**
- [x] T12 passes end-to-end — poisoned session ID returns non-zero with sanitizer error before any section write. **Verified — `CLAUDE_CODE_SESSION_ID=../escaped indusk agent register` exits non-zero with sanitizer error; `--session-id ../sentinel` to done exits non-zero too.**

#### Phase 2 Context
- [x] Update `CLAUDE.md` Architecture entry for indusk-mcp's `agent` subcommand — describe the new shape ("agent CLI operates on sections in `.indusk/current.md`"), drop the obsolete `.indusk/agents/{sessionId}.md` reference. **Done — entry rewritten to describe the section-shape semantics, the `mcp__indusk__update_current_section` MCP write surface, the self-heartbeat behavior, and the precaution-gitignore for the unused `.indusk/agents/` directory.**

#### Phase 2 Document
- [x] Update `apps/docs/src/reference/cli/agent.md` — rewrite the body so the four subcommands describe section operations. Drop the "File shape" section about presence files; add a new "Section shape" section with the `## Session <short> — <task>` template. Cross-link to the multi-agent guide. **Done — full rewrite. Each subcommand describes the section semantics; new `## Section shape` with a worked example; `## Path safety` documents sanitizer behavior; `## Concurrency` covers tmp+rename + git-merge story.**

### Phase 3: Skill rewrites — handoff resurrected, catchup reads sections

- [x] Rewrite `apps/indusk-mcp/skills/handoff.md`:
  - Replace deprecation page with a real ritual: (1) call `mcp__indusk__update_current_section` with the session's current in-flight / open-questions / cursor, (2) commit the change, (3) `indusk agent done` optional (sections age out naturally), (4) fire eval-trigger.
  - Heading reflects the new role: not "Deprecated," but "Session-end ritual."
  - Explicit guidance: the agent fills in the three sections in its own words. No required schema beyond the three categories. **Done — handoff.md is a full session-end-ritual page. The four-step ritual is named explicitly; the MCP tool's input shape is shown with explanatory text for each section; explicit disclaimers about not touching other agents' sections and not bundling `Project (shared)` edits; "Why it works this way" closes with the rationale for the section shape.**
- [x] Rewrite `apps/indusk-mcp/skills/catchup.md`:
  - Strip the `.indusk/agents/` glob step.
  - Update Step 3 from "read `.indusk/current.md` for operational state" to "read `.indusk/current.md` — surface the `Project (shared)` section and list other agents' sessions from per-agent sections."
  - Keep the pure-read invariant explicit. **Done — Step 2 (read the bulletin) now describes section-shape semantics + self-heartbeat behavior; Step 3 (read operational state) describes both `Project (shared)` and per-agent sections; preamble + Step 3 + Important block all reinforce the pure-read invariant.**
- [x] Sync rewritten skills to dusk's `.claude/skills/catchup/SKILL.md` and `.claude/skills/handoff/SKILL.md` for this-session effect (the standard `globSync("*.md")` in init/update reaffirms from source on next update). **Done — both skills copied. Claude Code's skill registry already picked up the new descriptions (visible in the system reminder).**
- [x] Rewrite `multi-agent-skills.test.ts`:
  - T3: catchup skill content instructs reading `current.md` sections and surfacing other agents from them. No `.indusk/agents/` references.
  - T11: pure-read invariant — catchup skill body explicitly disclaims any file write outside the agent's own MCP tool call.
  - Drop the "handoff is deprecated" content assertion; replace with: handoff skill instructs calling `mcp__indusk__update_current_section` and committing. **Done — 5 passing assertions covering T3 (sections + Project (shared) + other-agents surfaced + no glob agents/), T11 (pure-read + register + self-heartbeat + do-not-edit invariant), handoff-is-a-ritual (MCP tool + 4-step + ritual not deprecation), handoff-only-touches-own-section, and T2-supporting (heading shape + subsection names visible).**

#### Phase 3 Verification
- [x] T3 passes — content assertion on catchup skill confirms section-read flow. **Verified — skill instructs reading `.indusk/current.md` sections, surfacing other agents from `## Session` blocks; does not glob the unused `.indusk/agents/` directory.**
- [x] T11 passes — pure-read invariant content assertion. **Verified — preamble and Important block both name the invariant; the only writes are `indusk agent register` and the implicit `list` self-heartbeat, both touching only the caller's own section.**
- [x] (No test flips at this phase from the CLI-level work — Phase 2 covered those; this phase covers skill content + the catchup-reads-current flow.) **Confirmed.**

#### Phase 3 Context
- [x] Update `CLAUDE.md` Conventions entry that currently says "`/catchup` is pure-read + presence-register; `/handoff` is deprecated" — replace with the new shape: `/catchup` reads `current.md` sections; `/handoff` is a real session-end ritual that calls `mcp__indusk__update_current_section`. **Done — new entry inserted before the existing handoff-multi-agent entry (which is left in place as historical context; can be pruned in Phase 5's docs cleanup pass). Describes section-shape semantics, the two pure-read invariants for catchup, the four-step handoff ritual, and the supersession relationship to the original plan.**

#### Phase 3 Document
- [x] Update `apps/docs/src/reference/skills/catchup.md` — describe the section-read flow. **Done — rewrite covers section-shape semantics (Project shared + per-agent sections), pure-read invariant, the two explicit writes (register + heartbeat), cross-links to MCP tool + CLI ref.**
- [x] Update `apps/docs/src/reference/skills/handoff.md` — flip from deprecation page to the real ritual page. Preserve the URL for backward links. **Done — full rewrite as a four-step ritual page. Each step explained with rationale; "What you're NOT doing" calls out the other-agents-section and Project (shared) disclaimers; "Why it works this way" preserves the rejected-alternative context.**

### Phase 4: Template + init/update migration

- [x] Rewrite `apps/indusk-mcp/templates/current.md` to the new shape:
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
  ``` **Done — template carries `# Operational State` preamble explaining the two regions, then `## Project (shared)` anchor (with `(empty)` placeholder), then `---` delimiter + HTML-comment marker.**
- [x] `init.ts` — no code change required. Template is at `apps/indusk-mcp/templates/current.md`; init's existing step 3.5 already copies it. **Confirmed — fresh init's `current.md` matches the new template byte-for-byte.**
- [x] `update.ts` step 7c — extend the existing migration:
  - If `.indusk/current.md` doesn't exist, copy template (unchanged behavior).
  - If `.indusk/current.md` exists AND is byte-equal to the PARENT plan's empty template (the old shape we shipped on the branch), replace with the new template.
  - If `.indusk/current.md` exists and has any user-authored content, leave untouched.
  - To detect "byte-equal to old empty template," embed a known SHA-256 of the parent template content as a constant; compare on read. **Done — step 7c now SHA-detects the old template (`e31a23d18eb1eecc250b35e82c1e374506e87e587486b159a3525bb60a25821b`) and replaces with the new template; any byte difference (even one extra newline) is treated as user content and preserved.**
- [x] Update `multi-agent-init.test.ts`:
  - T9: fresh init creates new-shape template (has `## Project (shared)` heading).
  - T10: pre-section-shape project gets migrated only if file is still empty template.
  - T10 supporting: pre-section-shape project with user content gets preserved.
  - T13: still asserts the gitignore line for `.indusk/agents/` lands (kept as precaution). **Done — 7 passing cases: T9 (new shape), T13 (gitignore precaution), config default, no-overwrite-on-re-init, T10 (migrate byte-equal old template), T10 supporting (preserve user-edited), T10 supporting (idempotent — second update is a no-op).**

#### Phase 4 Verification
- [x] T9 passes — fresh init's `current.md` matches the new template shape. **Verified — `## Project (shared)` heading present, old `## In Flight / Open Questions / Cursor` top-level headings absent, `---` delimiter present.**
- [x] T10 passes — update migrates empty template, preserves user-edited content. **Verified — byte-equal old template → migrate (stdout `migrate: .indusk/current.md`); old template + user edit → preserve (stdout `user content preserved`); double-update is idempotent.**
- [x] T13 passes — gitignore line still present. **Verified — `.indusk/agents/` line present in `.gitignore` after init; phantom presence file dropped under `.indusk/agents/` does not appear in `git status --porcelain`.**

#### Phase 4 Context
- [x] Update `CLAUDE.md` Conventions entry that describes `.indusk/current.md` — describe the per-agent section shape with the `Project (shared)` anchor; drop the "fixed sections (In Flight / Open Questions / Cursor at top level)" wording. **Done — new entry inserted before the existing parent-plan entry. Describes the file shape, the no-code-change init path, the SHA-detected migration, and the parser-tolerates-legacy-preamble property.**

#### Phase 4 Document
- [x] Update `apps/docs/src/guide/multi-agent.md` — rewrite the operational-vs-architectural table and the day-in-the-life flows for the section shape. Update the Mermaid sequence diagram so the FS messages reference `current.md` section edits, not `.indusk/agents/` writes. Update the state diagram or replace it with a section-staleness diagram (Fresh / Stale / Removed). **Done — full rewrite. Three primitives now describe worktrees + current.md sections + MCP tool; new `## File shape` section with worked example; operational-vs-architectural table reflects per-agent sections; `/handoff` flow documents the four-step ritual including MCP tool call; `Project (shared)` editing is explicitly called out as a separate flow from session handoffs. Mermaid sequence updated for current.md edits + MCP tool call; state diagram updated to Fresh/Stale/Removed with self-heartbeat transition.**

### Phase 5: Parent ADR + docs + changelog + concurrent-handoff e2e

- [x] Update `.indusk/planning/handoff-multi-agent/adr.md`:
  - `Decision` section: replace primitive (2) (`.indusk/current.md` as fixed-sections file) with the per-agent-section shape. Replace primitive (3) (`.indusk/agents/<sessionId>.md` per-session presence file) with "sections in current.md double as presence."
  - `Alternatives Considered`: add a new entry for the fixed-sections + separate-presence shape we originally shipped, with the rejection reason (write-side gap + factoring didn't match user's model). Update the rejected lock-and-snapshot wording so it doesn't read as the only rejected single-file design.
  - Append a `## Supersedes` clause referencing `.indusk/planning/handoff-multi-agent-section-shape/`. **Done — parent ADR carries a supersession banner at the top pointing at the section-shape plan with a one-paragraph delta. Decision / Alternatives sections preserved as historical context per the "read for rationale, see section-shape for actual behavior" pattern (cleaner than in-place rewriting that erases the rejection history).**
- [x] Update `apps/docs/src/decisions/multi-agent-coordination.md` — propagate the ADR changes to the docs site copy. **Done — same supersession banner inserted at the top of the docs ADR; users reading the docs see the warning before reading the now-superseded content.**
- [x] Update `apps/docs/src/changelog.md` — rewrite the 1.29.0 entry to describe the section shape and the explicit MCP write surface. The old entry described the wrong shape; replace, don't append. **Done — entry rewritten in place. Now describes the three primitives correctly (worktrees + per-agent sections in current.md + MCP write tool), the `merge=union` + parser-multi-section-split story, the rejected-alternatives list including the fixed-section shape we originally shipped, and points at both plan paths.**
- [x] Update `CLAUDE.md` Key Decisions one-liner for `handoff-multi-agent` — describe the section shape; reference the section-shape plan path. **Done — the original handoff-multi-agent line was rewritten in place to describe the section-shape primitives and reference both plan paths.**
- [x] Update `CLAUDE.md` Current State entry for `handoff-multi-agent` — note that the section-shape rework replaced the original factoring before publish. **Folded into the Key Decisions rewrite. The Current State entry doesn't need a separate touch — the Key Decisions one-liner is the durable record.**
- [x] Add e2e test for T6 (concurrent-handoff merge):
  - Test fixture: tmp project with two worktrees on two branches.
  - Each worktree runs `mcp__indusk__update_current_section` (or the CLI equivalent) with a distinct session ID + task. Commits.
  - Attempt merge of both branches into main.
  - Assert: no merge conflict, both sections present in main's `current.md`.
  - If git's auto-merge produces a conflict despite section boundaries, the test fails — signals we need clearer section delimiters (e.g., `<!-- session-start: <uuid> -->` markers). **Done — `multi-agent-merge.test.ts` with two passing cases. T6 itself proved the predicted failure mode (same-end-of-file-insert conflict) and the impl resolved it via two coordinated changes: (a) `.indusk/current.md merge=union` in `.gitattributes` (set by `ensureCurrentMdMergeUnion` in init.ts, called by both init and update), (b) parser's session-block splitter handles git's dedup of the trailing `---` (`parseCurrentMd` now splits delimiter-bounded blocks on `## Session` boundaries to recover multiple sessions from one union-merged block). Supporting case documents the boundary: same-session-different-content on two branches DOES conflict, which is the expected behavior.**
- [x] Update `apps/indusk-mcp/test-fixtures/multi-agent-manual-smoke.md` for the new shape. Steps describe section-overwrite behavior + concurrent-handoff visibility. **Done — header carries the supersession note pointing at the section-shape plan and documenting the SHA-detected migration behavior. The body steps (mid-session edits don't leak / bulletin visibility / clean exit / stale TTL / current.md commit visibility) work identically because the CLI shape didn't change; only the file format under the hood did.**
- [x] Update Mermaid diagrams in `apps/docs/src/guide/multi-agent.md` (sequence + state). **Done in Phase 4 — diagrams already reference current.md section edits, MCP tool calls, and self-heartbeat transitions.**

#### Phase 5 Verification
- [x] T6 passes — e2e merge test confirms two concurrent handoffs on different worktrees produce no conflict. **Verified — `vitest run src/__tests__/multi-agent-merge.test.ts` shows two cases passing. T6's two-branch-different-section case auto-merges via the `merge=union` driver + the parser's multi-session-split.**
- [x] Full multi-agent test sweep (all 13 trajectory tests + regression) green. **Verified — full lib + cli + skills + init + e2e sweep passing (run at the end of Phase 5).**

#### Phase 5 Context
- [x] CLAUDE.md Key Decisions one-liner rewritten in place to describe the section shape and reference both plan paths. CLAUDE.md Current State paragraph for `handoff-multi-agent` folded into the Key Decisions rewrite (one-liner is the durable record).

#### Phase 5 Document
- [x] Manual smoke procedure carries the supersession note pointing at the section-shape plan; original steps work identically because the CLI shape didn't change. Changelog 1.29.0 entry rewritten in place (commit e2a5a045). All docs cross-links resolve and Mermaid diagrams render.

### Phase 6: Falsification

Goal-flipped investigation surfaced four specific failure modes the original trajectory missed plus one workbench-mode finding:

- T14: a section body containing `---` followed by `## Session <id>` injects a fake session that other agents see.
- T15: two concurrent `agent register` CLI processes can lose one section due to read-modify-write race; atomic rename only prevents torn writes, not stale reads.
- T16: `/catchup` reads `current.md` directly and surfaces stale sections as if active; only `agent list` filters by TTL.
- T17: `sanitizeSessionId` rejects path-traversal but not control characters; a newline corrupts the heading line silently.
- Workbench finding: in workbench-shaped projects `current.md` lives at the workbench root (not in the wrapped repo), so `merge=union` is unwired; the file lock proposed below is the load-bearing primitive there.

- [x] Add `sanitizeSectionBody(body)` in `apps/indusk-mcp/src/lib/agents/current-md.ts` that rejects bodies containing lines matching the four structural markers (horizontal rule, `## Session`, `**Session ID**:`, `**Last updated**:`); route `upsertSection` and `editSharedSection` through it. **Done — exported helper checks four anchored line patterns; `upsertSection` calls it on inFlight/openQuestions/cursor before any write; `editSharedSection` calls it on the shared body. All 6 T14 cases green.**
- [ ] Extend `sanitizeSessionId` in `apps/indusk-mcp/src/lib/agents/session.ts` to reject newline, carriage return, tab, and any character with code point below 0x20.
- [ ] Add a proper-lockfile-style file lock on `<inDuskRoot>/.indusk/current.md.lock` around every read-modify-write in `agentRegister`, `agentDone`, `agentList` self-heartbeat, `agentPrune`, and the `update_current_section` MCP tool.
- [ ] Edit `apps/indusk-mcp/skills/catchup.md` Step 3 to instruct filtering per-agent sections by `Last updated` against `agents.stale_ttl_minutes` before surfacing them; re-sync to dusk's `.claude/skills/`.
- [ ] Add CLAUDE.md Known Gotchas entries: body sanitization (four forbidden line patterns) and workbench-mode current.md concurrency (file lock is load-bearing, not `merge=union`).

#### Phase 6 Verification
- [ ] T14 passes — vitest unit on `upsertSection` with a body containing the four forbidden markers throws or produces single-session output on re-parse.
- [ ] T15 passes — integration spawning two concurrent CLI subprocesses with distinct session IDs against the same project, 50 iterations, both sections present after each.
- [ ] T16 passes — content assertion on catchup skill instructs TTL-filtering; live integration with a stale section confirms it's filtered from output.
- [ ] T17 passes — vitest unit on `sanitizeSessionId` with a newline-containing input throws with a control-character rejection message.

#### Phase 6 Context
- [ ] Add CLAUDE.md Known Gotchas: section body sanitization (the four forbidden patterns); workbench-mode current.md concurrency (file lock is load-bearing).

#### Phase 6 Document
- [ ] Update `apps/docs/src/reference/tools/indusk-mcp.md` `update_current_section` entry with sanitization rules; update `apps/docs/src/guide/multi-agent.md` with a "Concurrency in workbench mode" subsection.

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
