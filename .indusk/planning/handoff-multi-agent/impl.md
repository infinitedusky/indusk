---
title: "Multi-Agent Coordination — Impl"
date: 2026-06-25
status: in-progress
trajectory: required
rationale: required
gate_policy: ask
---

# Multi-Agent Coordination — Impl

## Goal

Ship the three primitives from the ADR — `.indusk/current.md` durable state, `.indusk/agents/{session-id}.md` presence bulletin, catchup-pure-read + handoff-deprecated — so two concurrent Claude Code sessions on one InDusk project no longer collide.

## Scope

### In Scope
- New `apps/indusk-mcp/src/lib/agents/` module: session-ID resolution, agents directory resolution, presence-file read/write, mtime-TTL filter.
- New `apps/indusk-mcp/src/bin/commands/agent.ts` CLI: `register`, `done`, `list`, `prune` subcommands.
- Rewrite `apps/indusk-mcp/skills/catchup.md`: strip checkbox mutation, add presence registration step, add bulletin read.
- Rewrite `apps/indusk-mcp/skills/handoff.md`: deprecation message + redirect to new flow.
- `indusk init` and `indusk update`: scaffold `.indusk/current.md` template, gitignore `.indusk/agents/`, add `agents.stale_ttl_minutes` config default.
- New user-facing docs: `apps/docs/src/guide/multi-agent.md`, `apps/docs/src/reference/cli/agent.md`, updated skill reference pages.

### Out of Scope
- Cross-machine presence visibility (laptop ↔ desktop). v1 is local-only.
- jj-mode support beyond what the existing SCM abstraction provides automatically. jj is deprecating; this lands git-native.
- Inter-agent messaging beyond passive bulletin reads.
- Auto-detection of `current.md` swamp conditions. The `/retrospective` distillation cadence is the existing control.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `apps/indusk-mcp/src/lib/agents/` module (types, `getSessionId()`, `getAgentsDir()`, `findInDuskRoot()` reuse); resolved session-ID source decision documented in Known Gotchas | Existing `apps/indusk-mcp/src/lib/scm/` walk-up patterns |
| Phase 2 | `apps/indusk-mcp/src/bin/commands/agent.ts` with `register`/`done`/`list`/`prune` subcommands wired into commander; vitest unit tests for the CLI | Phase 1 lib |
| Phase 3 | Rewritten `catchup.md` and `handoff.md` skills in `apps/indusk-mcp/skills/`; auto-sync via existing `globSync("*.md")` in init/update | Phase 2 CLI surface |
| Phase 4 | `init` and `update` scaffolding: `.indusk/current.md` template, `.indusk/agents/` gitignore line, `agents.stale_ttl_minutes` config default; migration tests | Phase 2 CLI, Phase 3 skills |
| Phase 5 | Integration test spawning concurrent CLI subprocesses; manual smoke procedure document; full docs (`multi-agent.md` guide with mermaid diagrams, CLI reference, skill reference updates) | Phases 1-4 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | Two agents starting catchup at the same time both complete without one freezing or hanging on the other. | Phase 0 | Phase 3 | written |
| T2 | When a new agent starts catchup, it can see the tasks the other currently-working agents are on. | Phase 0 | Phase 3 | written |
| T3 | Registering as an agent makes you visible to other agents within 5 seconds. | Phase 0 | Phase 2 | passing |
| T4 | An agent that ends cleanly disappears from the bulletin other agents see. | Phase 0 | Phase 2 | passing |
| T5 | An agent that crashed without cleanup stops appearing on the bulletin after the configured stale TTL elapses. | Phase 0 | Phase 2 | passing |
| T6 | After someone commits an edit to the durable project-state file on main, the next agent's catchup reflects the new state. | Phase 0 | Phase 3 | written |
| T7 | Running catchup does not modify any file that other agents would observe. | Phase 0 | Phase 3 | written |
| T8 | The deprecated handoff command exits with a message that tells the user what to do instead. | Phase 0 | Phase 3 | written |
| T9 | On a system where Claude Code's session ID env var is unset, agent registration still works and uses a stable per-session identifier. | Phase 1 | Phase 1 | passing |
| T10 | Two agents in different worktrees on the same workbench can each edit their own branches without their changes appearing in each other's working trees mid-session. | Phase 0 | Phase 5 | written |
| T11 | A new teammate cloning the project sees no leftover presence files from the original developer's machine. | Phase 0 | Phase 4 | written |

### Deferred Verification

- **U1 — catchup output usefulness**
  - reason: UX judgment; depends on session context that no automated test can reproduce.
  - would require: outsider usability testing on a stable design, or longitudinal feedback signal across many sessions.
  - mitigation: feedback signal — Sandy uses catchup at the start of every session; any session where the output feels wrong or missing becomes a retrospective lesson tracked at the docs site.

- **U2 — agents actually coordinate (not just see each other)**
  - reason: coordination depends on agent reasoning, which is non-deterministic; no test can prove "the other agent noticed and adjusted."
  - would require: a long-running observational study comparing same-file-edit collision rates with and without the bulletin.
  - mitigation: telemetry alert — eval agent flags sessions where two agents touched the same file within a 5-minute window; rising rate indicates the bulletin is being read but not acted on.

### Trajectory Rationale

Phase 0 is the writable baseline. The only Phase 1+ row is T9, listed below.

- **T9** `Writable at: Phase 1` — Subject is the `getSessionId` function and the resolved fallback semantics authored in Phase 1's spike. The test imports the symbol from `apps/indusk-mcp/src/lib/agents/session.ts`; no import target exists before then, so the test file is a compile error against today's source. Phase 1 also resolves the fallback mechanism (PID-at-start is fragile across subprocesses; the spike picks the actual answer), so the assertion's pass criterion isn't defined until Phase 1.

## Checklist

### Phase 1: Session-ID spike + lib scaffold

- [x] Verify which env var Claude Code exposes for stable per-session identification. Try `$CLAUDE_SESSION_ID`, `$CLAUDE_CODE_SESSION_ID`, anything in the Claude Code docs. Record the actual name in a comment at the top of `session.ts`. **Result: `CLAUDE_CODE_SESSION_ID` (UUID, inherited by subprocesses). Verified via `env` inspection in an active Claude Code session, SDK version 0.3.187.**
- [x] If no env var is stable, design a fallback that survives across subprocess calls within one Claude Code session — candidate: lazy-init a session ID on first `agent register` call, persist to a temp file keyed by parent PID, reuse on subsequent calls. Document the chosen mechanism in CLAUDE.md Known Gotchas. **Result: env var IS stable. Fallback is `pid-<N>` (single-process stability only; acceptable since non-Claude-Code use is rare and stale TTL ages out fragmented entries).**
- [x] Create `apps/indusk-mcp/src/lib/agents/` module:
  ```typescript
  // apps/indusk-mcp/src/lib/agents/session.ts
  export function getSessionId(): string

  // apps/indusk-mcp/src/lib/agents/paths.ts
  export function findInDuskRoot(cwd: string): string  // reuse existing walk-up if available
  export function getAgentsDir(inDuskRoot: string): string  // <inDuskRoot>/.indusk/agents/

  // apps/indusk-mcp/src/lib/agents/types.ts
  export interface PresenceFile {
    sessionId: string
    task: string
    branch: string | null
    worktree: string
    startedAt: string  // ISO
  }
  ```
- [x] Reuse `findInDuskRoot()` from existing code if it already exists in `lib/scm/` or `lib/config.ts`; otherwise extract from wherever the duplicate walk-up logic lives. **Result: `resolveProjectRoot` already exists at `apps/indusk-mcp/src/lib/config.ts:20`; `paths.ts` re-exports it rather than duplicating.**
- [x] Vitest unit tests for the three exported functions: env var present case, env var absent fallback case, walk-up resolution from project subdirectories, walk-up from worktree to workbench root. **Result: 12 tests across `session.test.ts` (6) and `paths.test.ts` (6) — all passing.**

#### Phase 1 Verification
- [x] T9 passes — `pnpm --filter indusk-mcp test src/lib/agents/__tests__/session.test.ts` shows the env-stripped subprocess case returning a stable identifier. **Verified 2026-06-25: 6 of 6 cases passing across both env-present and env-absent branches.**

#### Phase 1 Context
- [x] Update `CLAUDE.md` Known Gotchas: add an entry describing the chosen session-ID source — if `$CLAUDE_SESSION_ID` is what Claude Code exposes, name it; if we ended up with a parent-PID + temp-file scheme, document that pattern so future code reuses it instead of reinventing. **Done — entry added documenting `CLAUDE_CODE_SESSION_ID` UUID + subprocess inheritance + `pid-<N>` fallback. Also corrects the brief's wrong-name guess (`CLAUDE_SESSION_ID`).**

#### Phase 1 Document
- [x] (none needed — asked: "Phase 1 Document gate: Phase 1 only produces the internal lib at apps/indusk-mcp/src/lib/agents/. Public surface lands in Phase 2 via the CLI reference. Skip Phase 1 docs?" — user: "Skip — it's an internal lib")

### Phase 2: CLI surface

- [x] Create `apps/indusk-mcp/src/bin/commands/agent.ts` with four subcommands:
  ```typescript
  // indusk agent register --task "<what>" [--branch <branch>] [--worktree <path>]
  // indusk agent done [--session-id <id>]  // defaults to current session
  // indusk agent list  // respects stale TTL from config
  // indusk agent prune  // removes all stale files
  ```
- [x] Wire into commander in `apps/indusk-mcp/src/bin/cli.ts`. Following the commander@13 pattern from CLAUDE.md gotchas: declare any shared flags on the parent command, not duplicated on subcommands. **Done — `agent` is a single-level subcommand group; no shared flags on the parent, so the commander@13 gotcha didn't bite here.**
- [x] `register` writes `<agentsDir>/<sessionId>.md` with a small markdown body matching the `PresenceFile` shape (frontmatter + body for legibility). **Done — YAML frontmatter via gray-matter + a Markdown body listing task/branch/worktree/started.**
- [x] `done` removes the file for the current session (or the one named via `--session-id`). Silently succeeds if the file is already gone. **Done — prints `already done (no presence file)` on the silent-success path.**
- [x] `list` reads `agents.stale_ttl_minutes` from `.indusk/config.json` (default 60), filters out files with mtime older than that, prints a compact table. **Done — formats a SESSION/TASK/BRANCH/STARTED table; prints `(no agents currently registered)` when empty.**
- [x] `prune` removes all stale files, prints what was removed. **Done — `Pruned N stale presence file(s)`.**
- [x] Vitest tests: 6 passing in `apps/indusk-mcp/src/__tests__/multi-agent-cli.test.ts` covering T3, T4, T5, supporting prune, empty list, silent-done.

#### Phase 2 Verification
- [x] T3 passes — register-then-list returns the registered task within 5s (measured elapsed ~600-900ms in vitest run).
- [x] T4 passes — done-then-list shows `(no agents currently registered)` for the just-removed entry.
- [x] T5 passes — utimesSync backdates the mtime; subsequent `list` filters the entry out; `prune` removes the file from disk.

#### Phase 2 Context
- [x] Update `CLAUDE.md` Architecture section: in the indusk-mcp CLI list, add `agent` to the subcommands (alongside `init`/`update`/`extensions`/`ui`/`telemetry`/`worktree`). **Done — added `agent` to the CLI list with a one-paragraph summary of the four subcommands, the session-ID source, and the TTL config field.**

#### Phase 2 Document
- [x] Write `apps/docs/src/reference/cli/agent.md` covering the four subcommands, their flags, the presence-file shape, and the TTL behavior. Link to the multi-agent guide (Phase 4) when it lands. **Done — page covers register/done/list/prune with flag tables, presence-file shape with example, TTL config, and concurrency rationale. New `CLI` sidebar group added to vitepress config (`apps/docs/src/.vitepress/config.ts`).**

### Phase 3: Skill rewrites

- [ ] Rewrite `apps/indusk-mcp/skills/catchup.md`:
  - Strip the checkbox state machine entirely.
  - Add Step N: call `indusk agent register --task "<one-line task description>"` after reading session context.
  - Add Step N+1: call `indusk agent list` and surface other agents' tasks in the catchup output.
  - Document that `/catchup` is pure-read for all files other than the agent's own presence file.
- [ ] Rewrite `apps/indusk-mcp/skills/handoff.md`:
  - Replace the entire body with a deprecation notice.
  - Body content: "Handoff is now a side-effect of normal commits. Edit `.indusk/current.md` if there's operational state worth promoting, commit it, then `indusk agent done`. See `apps/docs/src/guide/multi-agent.md` for the new flow."
  - Keep the skill file (so `/handoff` doesn't 404), but make it deprecation-only.
- [ ] Verify the existing `globSync("*.md")` in both `init.ts` and `update.ts` picks up both rewritten files. (CLAUDE.md says this is already the convention — no new wiring needed.)
- [ ] Vitest tests:
  - Catchup skill content does not contain the old checkbox-state-machine markers.
  - Handoff skill content contains the deprecation phrase.
  - Both files are picked up by the auto-sync glob (assert by spying on `globSync` or running a temp init and checking output).

#### Phase 3 Verification
- [ ] T1 passes — integration test spawns two `indusk agent register` calls concurrently; both succeed without one blocking the other.
- [ ] T2 passes — after two registrations, a third `indusk agent list` call shows both other agents.
- [ ] T6 passes — manual smoke confirms: agent A edits `.indusk/current.md`, commits to main, agent B starts a new session, B's catchup output shows the new content.
- [ ] T7 passes — running the updated catchup skill flow in a temp project does not modify any tracked file or any other agent's presence file (assertion: filesystem mtime diff before/after shows only the current agent's presence file changed).
- [ ] T8 passes — opening the new handoff skill file confirms it contains the deprecation message and the redirect to the multi-agent guide.

#### Phase 3 Context
- [ ] Update `CLAUDE.md` Conventions section: add "`/catchup` is pure-read + presence-register; `/handoff` is deprecated. Concurrent Claude Code sessions on one project use `.indusk/current.md` for durable state and `.indusk/agents/` for presence bulletins."

#### Phase 3 Document
- [ ] Update `apps/docs/src/reference/skills/catchup.md`: strip checkbox-mutation references; document the pure-read behavior; document the registration side-effect; link to `agent.md` CLI reference.
- [ ] Update `apps/docs/src/reference/skills/handoff.md`: convert to a deprecation page; preserve the URL for backward links; point to the new flow.

### Phase 4: current.md + init/update scaffolding

- [ ] In `apps/indusk-mcp/src/bin/commands/init.ts`:
  - Write `.indusk/current.md` from a template if it doesn't exist. Template has three sections: `## In Flight`, `## Open Questions`, `## Cursor` (each with placeholder text the working agent overwrites).
  - Add `.indusk/agents/` to the gitignored paths (alongside other `.indusk/`-relative gitignore entries).
  - Write `agents.stale_ttl_minutes: 60` into `.indusk/config.json` default if the field is absent.
- [ ] In `apps/indusk-mcp/src/bin/commands/update.ts`:
  - Idempotently apply the same three scaffolding steps. If `.indusk/current.md` exists, leave it. If `.indusk/agents/` is not gitignored, add it. If `agents.stale_ttl_minutes` is absent, add the default.
- [ ] Vitest tests:
  - Fresh init creates `.indusk/current.md` with the three template sections.
  - Fresh init gitignores `.indusk/agents/`.
  - Fresh init writes the config default.
  - Update on an existing 1.28.x project (no `.indusk/current.md`) creates one.
  - Update on a project that already has `.indusk/current.md` does not overwrite it.
  - Update on a project that already has the gitignore line does not duplicate it.

#### Phase 4 Verification
- [ ] T11 passes — after `indusk init` followed by a fresh clone (vitest fixture: init in tmpA, copy to tmpB without `.indusk/agents/`, assert `git status` shows clean in tmpB).

#### Phase 4 Context
- [ ] Update `CLAUDE.md` Conventions section: add "`.indusk/current.md` is the operational state layer (in-flight work, open threads, cursor). CLAUDE.md is the architectural layer. `/retrospective` distills the former into the latter on its existing cadence."

#### Phase 4 Document
- [ ] Write `apps/docs/src/guide/multi-agent.md` introducing the convention: what `current.md` is for, what `.indusk/agents/` does, when to edit each, how `/catchup` and the deprecated `/handoff` fit in. Cross-link to CLI reference and skill pages.

### Phase 5: Integration + manual smoke

- [ ] End-to-end integration test in `apps/indusk-mcp/src/__tests__/multi-agent-e2e.test.ts`:
  - Spawn a tmp workbench using the worktree extension.
  - Create two worktrees.
  - In each worktree, run `indusk agent register --task "..."`.
  - From the workbench root, run `indusk agent list`; assert both agents appear.
  - In one worktree, edit `.indusk/current.md` and commit on the worktree's branch.
  - Confirm the change is NOT visible in the other worktree's `current.md` (commit-mediated isolation).
  - Merge the change to main. Confirm a fresh `git pull` in the second worktree surfaces the change.
- [ ] Write `apps/indusk-mcp/test-fixtures/multi-agent-manual-smoke.md` covering the two-Claude-Code-sessions procedure: setup, expected catchup output for each session, sequence to demonstrate `current.md` commit visibility, sequence to demonstrate clean shutdown removes presence file.
- [ ] Sandy runs the manual smoke procedure against his actual workflow. T10 marked passing only after that.

#### Phase 5 Verification
- [ ] T10 passes — manual smoke confirmed by Sandy. Document the smoke result in this phase's verification log.
- [ ] All Phase 1-4 trajectory rows still passing (regression check on T1, T2, T3, T4, T5, T6, T7, T8, T9, T11).

#### Phase 5 Context
- [ ] Update `CLAUDE.md` Current State section: add multi-agent coordination to the shipped capabilities. Reference this plan's archive location.

#### Phase 5 Document
- [ ] Complete `apps/docs/src/guide/multi-agent.md` with mermaid diagrams:
  - Sequence diagram showing two concurrent agents from start (both register) through mid-work (both glob, both edit their own branches) to one committing `current.md`.
  - State diagram showing presence-file states (none / fresh / stale / cleaned) and the transitions.
- [ ] Add a changelog entry: "Added multi-agent coordination: concurrent Claude Code sessions on one project no longer collide; `current.md` + `.indusk/agents/` bulletin + worktree isolation. `/handoff` deprecated; `/catchup` is now pure-read."
- [ ] Publish ADR to docs at `apps/docs/src/decisions/multi-agent-coordination.md` (per ADR Documentation Plan).

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/agents/session.ts` | New — getSessionId with env var + fallback |
| `apps/indusk-mcp/src/lib/agents/paths.ts` | New — findInDuskRoot + getAgentsDir |
| `apps/indusk-mcp/src/lib/agents/types.ts` | New — PresenceFile type |
| `apps/indusk-mcp/src/lib/agents/__tests__/` | New — unit tests for the three modules above |
| `apps/indusk-mcp/src/bin/commands/agent.ts` | New — register/done/list/prune subcommands |
| `apps/indusk-mcp/src/bin/commands/__tests__/agent.test.ts` | New — CLI behavior tests |
| `apps/indusk-mcp/src/bin/cli.ts` | Modified — wire agent subcommand into commander |
| `apps/indusk-mcp/skills/catchup.md` | Rewritten — pure-read + presence registration |
| `apps/indusk-mcp/skills/handoff.md` | Rewritten — deprecation page |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Modified — scaffold current.md, gitignore agents/, config default |
| `apps/indusk-mcp/src/bin/commands/update.ts` | Modified — idempotent migration of the same three items |
| `apps/indusk-mcp/src/bin/commands/__tests__/init.test.ts` | Modified — assert new scaffolding |
| `apps/indusk-mcp/src/bin/commands/__tests__/update.test.ts` | Modified — assert migration is idempotent |
| `apps/indusk-mcp/src/__tests__/multi-agent-e2e.test.ts` | New — end-to-end concurrent-agent test |
| `apps/indusk-mcp/test-fixtures/multi-agent-manual-smoke.md` | New — manual smoke procedure |
| `apps/indusk-mcp/templates/current.md` | New — template for the durable operational-state file |
| `apps/docs/src/guide/multi-agent.md` | New — user-facing guide |
| `apps/docs/src/reference/cli/agent.md` | New — CLI reference |
| `apps/docs/src/reference/skills/catchup.md` | Modified — pure-read documentation |
| `apps/docs/src/reference/skills/handoff.md` | Modified — deprecation page |
| `apps/docs/src/decisions/multi-agent-coordination.md` | New — ADR published to docs (Phase 5) |
| `CLAUDE.md` | Modified — Architecture (CLI list), Conventions (new entries), Known Gotchas (Phase 1 session-ID finding), Current State |

## Dependencies

- Worktree extension shipped (verified — Phases 2-7 landed 2026-05-28 → 2026-05-30).
- SCM abstraction layer (`apps/indusk-mcp/src/lib/scm/`) — already exists.
- Commander@13 — already in use; mind the duplicate-flag-on-subcommand gotcha documented in CLAUDE.md.
- Existing `globSync("*.md")` in init/update for skills auto-sync — already in place.

## Notes

- Phase 1 spike is the only place this plan touches genuinely-unknown territory (what Claude Code's session ID env var is or is not). Budget for one full session on the spike alone if the env var turns out not to exist; the fallback design will need real thought.
- The CLI surface is small enough that Phase 2 should be a single afternoon. Most of the test code is fixture setup, not logic.
- Phase 3 skill rewrites should be done as edits to the package source (`apps/indusk-mcp/skills/`), not direct edits to `.claude/skills/` — the existing globSync sync mechanism handles distribution to consumers on next `indusk update`.
- Phase 5 manual smoke is the only place a non-Sandy human can't fully verify the work. Sandy's runbook execution is required for T10 to pass.
- The test plan in `test-plan.md` uses A1–A11 + U1–U2 IDs (assertion-prefixed). They map 1:1 to T1–T11 + U1–U2 here. The trajectory uses T-prefix per the InDusk convention; the assertion text is identical between the two documents.
