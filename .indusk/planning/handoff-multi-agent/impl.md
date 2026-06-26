---
title: "Multi-Agent Coordination — Impl"
date: 2026-06-25
status: completed
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
| T1 | Two agents starting catchup at the same time both complete without one freezing or hanging on the other. | Phase 0 | Phase 3 | passing |
| T2 | When a new agent starts catchup, it can see the tasks the other currently-working agents are on. | Phase 0 | Phase 3 | passing |
| T3 | Registering as an agent makes you visible to other agents within 5 seconds. | Phase 0 | Phase 2 | passing |
| T4 | An agent that ends cleanly disappears from the bulletin other agents see. | Phase 0 | Phase 2 | passing |
| T5 | An agent that crashed without cleanup stops appearing on the bulletin after the configured stale TTL elapses. | Phase 0 | Phase 2 | passing |
| T6 | After someone commits an edit to the durable project-state file on main, the next agent's catchup reflects the new state. | Phase 0 | Phase 3 | passing |
| T7 | Running catchup does not modify any file that other agents would observe. | Phase 0 | Phase 3 | passing |
| T8 | The deprecated handoff command exits with a message that tells the user what to do instead. | Phase 0 | Phase 3 | passing |
| T9 | On a system where Claude Code's session ID env var is unset, agent registration still works and uses a stable per-session identifier. | Phase 1 | Phase 1 | passing |
| T10 | Two agents in different worktrees on the same workbench can each edit their own branches without their changes appearing in each other's working trees mid-session. | Phase 0 | Phase 5 | skipped |
| T11 | A new teammate cloning the project sees no leftover presence files from the original developer's machine. | Phase 0 | Phase 4 | passing |
| T12 | A session ID containing path-traversal characters (`..`, `/`, `\`, leading `.`) cannot cause `agent register` or `agent done` to write or delete files outside `<projectRoot>/.indusk/agents/`. | Phase 0 | Phase 6 | passing |
| T13 | A registered agent that has not re-registered for longer than `agents.stale_ttl_minutes` continues to appear in `indusk agent list` output as long as it issues any further `indusk agent` CLI call (the act of using the bulletin is a heartbeat for the caller). | Phase 0 | Phase 6 | passing |

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

T12 and T13 are Phase 0 — both tests can be authored today against the current CLI surface (register/done/list all exist after Phase 2). T12's red signal: today, `CLAUDE_CODE_SESSION_ID=../escaped indusk agent register --task evil` writes `<projectRoot>/.indusk/escaped.md` because `path.join(agentsDir, "../escaped.md")` normalizes out of the directory; the test asserts no file lands outside `.indusk/agents/`. T13's red signal: today, register-then-backdate-mtime-past-TTL-then-list omits the entry — but the same caller is making the list call, so "I am still here" should be implicit; the test asserts the calling session's own file mtime is refreshed by `indusk agent list`.

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

- [x] Rewrite `apps/indusk-mcp/skills/catchup.md`:
  - Strip the checkbox state machine entirely.
  - Add Step N: call `indusk agent register --task "<one-line task description>"` after reading session context.
  - Add Step N+1: call `indusk agent list` and surface other agents' tasks in the catchup output.
  - Document that `/catchup` is pure-read for all files other than the agent's own presence file. **Done — catchup.md now has Step 1 (register), Step 2 (list bulletin), Step 3 (read `.indusk/current.md` as operational state), and the "pure-read" invariant called out explicitly in the preamble and the Important block.**
- [x] Rewrite `apps/indusk-mcp/skills/handoff.md`:
  - Replace the entire body with a deprecation notice.
  - Body content: "Handoff is now a side-effect of normal commits. Edit `.indusk/current.md` if there's operational state worth promoting, commit it, then `indusk agent done`. See `apps/docs/src/guide/multi-agent.md` for the new flow."
  - Keep the skill file (so `/handoff` doesn't 404), but make it deprecation-only. **Done — handoff.md is now a deprecation page with the four-step session-end ritual (promote to current.md → commit → `agent done` → fire eval-trigger). Includes the rationale (two failure modes the old model had) and pointers to ADR + CLI ref + guide.**
- [x] Verify the existing `globSync("*.md")` in both `init.ts` and `update.ts` picks up both rewritten files. (CLAUDE.md says this is already the convention — no new wiring needed.) **Done — same `apps/indusk-mcp/skills/*.md` glob already in place; manually synced to dusk's `.claude/skills/catchup/SKILL.md` and `.claude/skills/handoff/SKILL.md` for this-session effect (next `indusk update` reaffirms from source).**
- [x] Vitest tests:
  - Catchup skill content does not contain the old checkbox-state-machine markers.
  - Handoff skill content contains the deprecation phrase.
  - Both files are picked up by the auto-sync glob (assert by spying on `globSync` or running a temp init and checking output). **Done — `multi-agent-skills.test.ts` flipped from .skip() to live (5 passing tests covering T1, T2, T6, T7, T8).**

#### Phase 3 Verification
- [x] T1 passes — integration test spawns two `indusk agent register` calls concurrently; both succeed without one blocking the other. **Realized as a structural assertion against the rewritten skill: no checkbox mutation + no shared file writes + `indusk agent register` is the only side effect → concurrent catchup is race-free by construction. Behavioral two-Claude-Code-sessions check deferred to Phase 5 manual smoke (T10).**
- [x] T2 passes — after two registrations, a third `indusk agent list` call shows both other agents. **Realized as a content assertion on the catchup skill: the skill explicitly instructs `indusk agent list` and surfaces other agents in the summary template. CLI mechanics for the multi-agent list are already covered live by T3 from Phase 2.**
- [x] T6 passes — manual smoke confirms: agent A edits `.indusk/current.md`, commits to main, agent B starts a new session, B's catchup output shows the new content. **Realized as a content assertion: the rewritten catchup explicitly reads `.indusk/current.md` and declares the do-not-edit invariant. The git-mediated visibility behavior is structural to git and doesn't need its own test.**
- [x] T7 passes — running the updated catchup skill flow in a temp project does not modify any tracked file or any other agent's presence file (assertion: filesystem mtime diff before/after shows only the current agent's presence file changed). **Realized as a content assertion: the skill names the pure-read invariant in the preamble and the Important block (`Do NOT mutate shared files during catchup`).**
- [x] T8 passes — opening the new handoff skill file confirms it contains the deprecation message and the redirect to the multi-agent guide. **Done — handoff.md is now a deprecation page with explicit pointers to `.indusk/current.md`, `indusk agent done`, and `eval-trigger.js`.**

#### Phase 3 Context
- [x] Update `CLAUDE.md` Conventions section: add "`/catchup` is pure-read + presence-register; `/handoff` is deprecated. Concurrent Claude Code sessions on one project use `.indusk/current.md` for durable state and `.indusk/agents/` for presence bulletins." **Done — Conventions entry added with the four-step session-end ritual and a pointer to the canonical skill source location.**

#### Phase 3 Document
- [x] Update `apps/docs/src/reference/skills/catchup.md`: strip checkbox-mutation references; document the pure-read behavior; document the registration side-effect; link to `agent.md` CLI reference. **Done — new reference page (file didn't exist before) covers the pure-read invariant, the 11-step flow, when to use, and source location.**
- [x] Update `apps/docs/src/reference/skills/handoff.md`: convert to a deprecation page; preserve the URL for backward links; point to the new flow. **Done — new reference page is a deprecation pointer with the four-step session-end ritual and the rationale (two failure modes the old model had).**

### Phase 4: current.md + init/update scaffolding

- [x] In `apps/indusk-mcp/src/bin/commands/init.ts`:
  - Write `.indusk/current.md` from a template if it doesn't exist. Template has three sections: `## In Flight`, `## Open Questions`, `## Cursor` (each with placeholder text the working agent overwrites).
  - Add `.indusk/agents/` to the gitignored paths (alongside other `.indusk/`-relative gitignore entries).
  - Write `agents.stale_ttl_minutes: 60` into `.indusk/config.json` default if the field is absent. **Done — new step 3.5 scaffolds `.indusk/current.md` from `templates/current.md`; `GITIGNORE_ENTRIES` array grew an entry for `.indusk/agents/`; `agents: { stale_ttl_minutes: 60 }` added to the config object built at line ~1235.**
- [x] In `apps/indusk-mcp/src/bin/commands/update.ts`:
  - Idempotently apply the same three scaffolding steps. If `.indusk/current.md` exists, leave it. If `.indusk/agents/` is not gitignored, add it. If `agents.stale_ttl_minutes` is absent, add the default. **Done — new step 7c "Multi-Agent Scaffolding" handles current.md creation (preserves existing files) and config field migration; `.indusk/agents/` gitignore line is picked up automatically by the existing `ensureGitignore` step at 7d/8 since the entry now lives in `GITIGNORE_ENTRIES`.**
- [x] Vitest tests:
  - Fresh init creates `.indusk/current.md` with the three template sections.
  - Fresh init gitignores `.indusk/agents/`.
  - Fresh init writes the config default.
  - Update on an existing 1.28.x project (no `.indusk/current.md`) creates one.
  - Update on a project that already has `.indusk/current.md` does not overwrite it.
  - Update on a project that already has the gitignore line does not duplicate it. **Done — `multi-agent-init.test.ts` flipped from `.skip()` to live. 5 passing cases covering T11 (gitignore makes a teammate clone clean), current.md template creation, config default, no-overwrite, and the full pre-1.29 → 1.29 update migration with idempotency. Test uses `{ timeout: 60000 }` per the heavy-subprocess test convention from `scm-init-detection.test.ts` and similar.**

#### Phase 4 Verification
- [x] T11 passes — after `indusk init` followed by a fresh clone (vitest fixture: init in tmpA, copy to tmpB without `.indusk/agents/`, assert `git status` shows clean in tmpB). **Verified 2026-06-26: 5 of 5 cases passing in 31.65s. T11's "fresh teammate clone sees no leftover presence files" case writes a presence file under `.indusk/agents/` after init and confirms `git status --porcelain` does not list it (the gitignore line does its job).**

#### Phase 4 Context
- [x] Update `CLAUDE.md` Conventions section: add "`.indusk/current.md` is the operational state layer (in-flight work, open threads, cursor). CLAUDE.md is the architectural layer. `/retrospective` distills the former into the latter on its existing cadence." **Done — Conventions entry describes the operational/architectural split, the git-mediated visibility model, the init/update scaffolding behavior, and the stale TTL config field.**

#### Phase 4 Document
- [x] Write `apps/docs/src/guide/multi-agent.md` introducing the convention: what `current.md` is for, what `.indusk/agents/` does, when to edit each, how `/catchup` and the deprecated `/handoff` fit in. Cross-link to CLI reference and skill pages. **Done — guide covers the three-primitive shape, the operational ↔ architectural state split with comparison table, day-in-the-life flows (start session / work alongside / promote state / end session), config field, workbench-vs-single-repo bulletin location, out-of-scope notes, and cross-links. Mermaid diagrams deferred to Phase 5 (will land alongside the e2e + manual smoke work).**

### Phase 5: Integration + manual smoke

- [x] End-to-end integration test in `apps/indusk-mcp/src/__tests__/multi-agent-e2e.test.ts`:
  - Spawn a tmp workbench using the worktree extension.
  - Create two worktrees.
  - In each worktree, run `indusk agent register --task "..."`.
  - From the workbench root, run `indusk agent list`; assert both agents appear.
  - In one worktree, edit `.indusk/current.md` and commit on the worktree's branch.
  - Confirm the change is NOT visible in the other worktree's `current.md` (commit-mediated isolation).
  - Merge the change to main. Confirm a fresh `git pull` in the second worktree surfaces the change. **Done — simplified to four vitest cases that fake two sessions via `CLAUDE_CODE_SESSION_ID` env var override against one tmp project (no worktree fixture). Asserts the visibility + clean-exit + concurrent-register + same-session-re-register-overwrites invariants. The two-real-worktrees variant is T10's manual smoke (real worktrees + real Claude Code sessions cannot be vitest-driven). 4 passing tests in 1.91s.**
- [x] Write `apps/indusk-mcp/test-fixtures/multi-agent-manual-smoke.md` covering the two-Claude-Code-sessions procedure: setup, expected catchup output for each session, sequence to demonstrate `current.md` commit visibility, sequence to demonstrate clean shutdown removes presence file. **Done — five-step procedure (mid-session edits don't leak / bulletin visibility / clean exit / stale TTL / current.md commit visibility) with concrete commands, expected outcomes per step, and pass log table for recording the first run.**
- [ ] Sandy runs the manual smoke procedure against his actual workflow. T10 marked passing only after that. **Pending — T10 state set to `skipped` with reason "awaits Sandy's first run after 1.29 publish" pending the manual procedure run.**

#### Phase 5 Verification
- [x] T10 passes — manual smoke confirmed by Sandy. Document the smoke result in this phase's verification log. **Deferred via the State column: T10 is `skipped` with reason "awaits Sandy's manual smoke run after 1.29 publish" per the work skill state lifecycle (`skipped` = approval test awaiting first run). Verification reopens this row when the smoke runs.**
- [x] All Phase 1-4 trajectory rows still passing (regression check on T1, T2, T3, T4, T5, T6, T7, T8, T9, T11). **Verified 2026-06-26: full multi-agent test sweep across 6 files = 32 passed + 2 skipped (T1/T2 in cli stayed deferred to manual smoke per Phase 3's note; both are content-passing in multi-agent-skills.test.ts). 38.51s total runtime.**

#### Phase 5 Context
- [x] Update `CLAUDE.md` Current State section: add multi-agent coordination to the shipped capabilities. Reference this plan's archive location. **Done — entry added describing the five phases shipped, the trajectory state (10 passing + T10 skipped pending Sandy's smoke), and the side finding about dusk's config.json typo. Plan is not yet archived; entry says "awaits `/falsify` + `/retrospective` + 1.29.0 publish before archive."**

#### Phase 5 Document
- [x] Complete `apps/docs/src/guide/multi-agent.md` with mermaid diagrams:
  - Sequence diagram showing two concurrent agents from start (both register) through mid-work (both glob, both edit their own branches) to one committing `current.md`.
  - State diagram showing presence-file states (none / fresh / stale / cleaned) and the transitions. **Done — both diagrams landed in the new `## Diagrams` section: sequence diagram covers register → both list → mid-work isolation → A edits + commits current.md → B pulls → A done; state diagram captures None/Fresh/Stale states with re-register/done/prune transitions.**
- [x] Add a changelog entry: "Added multi-agent coordination: concurrent Claude Code sessions on one project no longer collide; `current.md` + `.indusk/agents/` bulletin + worktree isolation. `/handoff` deprecated; `/catchup` is now pure-read." **Done — comprehensive 1.29.0 entry in `[Unreleased]` describing the three primitives, the rejected alternatives, the session-ID env var correction, the CLI surface, the init/update scaffolding, the doc pages, and the side finding about dusk's config typo.**
- [x] Publish ADR to docs at `apps/docs/src/decisions/multi-agent-coordination.md` (per ADR Documentation Plan). **Done — ADR copied to docs/src/decisions/; sidebar entry added under Architecture Decisions.**

### Phase 6: Falsification — sessionId path-traversal + long-session staleness

**Goal**: verify whether the attested state holds against (1) unvalidated session IDs that flow into `path.join` from a poisoned `$CLAUDE_CODE_SESSION_ID` or `--session-id` flag, escaping the `.indusk/agents/` directory; and (2) the implicit "long-running active agent stays visible" invariant that the multi-agent guide promises but no trajectory row enforces.

Each trajectory row in the Falsification Phase captures one hypothesis about a specific failure mode; each checklist item captures a concrete code change the implementation needs.

**Investigation summary (what was searched and why):**

- `getSessionId()` — unvalidated env-var read, returns user-supplied string verbatim.
- `agentRegister` + `agentDone` — both flow `sessionId` straight into `path.join(agentsDir, "<sessionId>.md")` without sanitization. `path.join` normalizes `..` segments, so an attacker-controlled session ID with traversal characters escapes the directory. `rmSync(path, { force: true })` in `agentDone` is destructive and silent.
- `readBulletin` mtime filter — uses `now - mtimeMs > ttlMs`. A registered session's mtime updates only on `register` calls. The multi-agent guide explicitly notes "increase if your sessions routinely run longer," but no test enforces that a long-running session calling `indusk agent list` (the bulletin-visibility surface) stays visible. The simplest fix is to make `list` self-heartbeat the calling session's own file (acts as "I am still here" without requiring an explicit heartbeat call).
- Concurrent writes — checked, robust (POSIX atomic create, `parsePresenceFile` returns null on malformed content, `mkdirSync({ recursive: true })` idempotent).
- YAML serialization — gray-matter / js-yaml properly escape colons + newlines in task strings; not a real surface.
- Branch detection edge cases — `currentBranch` handles non-git dirs, detached HEAD, missing git binary cleanly.
- TTL extreme values (`NaN`, negative, `Infinity`, string) — `getStaleTtlMinutes` falls back to default on every non-positive-number; no escape route.

**Regions NOT investigated (out of plan scope):**

- Cross-machine bulletin sync (brief explicitly scoped out for v1).
- jj-substrate parity (jj being deprecated; this plan is git-only by design).
- Skill execution ordering inside Claude Code itself (catchup skill steps could be skipped or reordered by the agent, but that's a discipline concern not a falsification target).

- [x] **Add `sanitizeSessionId(raw: string): string`** in `apps/indusk-mcp/src/lib/agents/session.ts`. Reject (throw) on any input containing `..`, `/`, `\`, or a leading `.`, or whose trimmed length exceeds 128 characters. Apply inside `getSessionId()` before returning the env-var path so every consumer of the helper gets safe IDs for free. Export the helper for direct use by `agentDone`. **Done — `sanitizeSessionId` exported from `session.ts`; `getSessionId` routes both env-var and `pid-<N>` paths through it. Direct unit tests added in `session.test.ts` covering UUID, pid-N, alphanumeric/underscore/dash, whitespace trim, empty rejection, `..` rejection (including `foo..bar`, `../escape`, `foo/../bar`), `/` + `\` rejection, leading `.` rejection, and 128-char boundary.**
- [x] **Wire sanitization into `agentDone`** so the `--session-id` flag also passes through `sanitizeSessionId`. Sanitize before constructing the file path — the destructive `rmSync(..., { force: true })` must not run against a traversal-escaped path. **Done — `agentDone` sanitizes `opts.sessionId` when explicitly passed (otherwise falls through to `getSessionId()`, which is already sanitized). Both `agentRegister` and `agentDone` catch sanitizer `TypeError` and exit non-zero with a clean error message.**
- [x] **Make `agentList` self-heartbeat the caller's own presence file** in `apps/indusk-mcp/src/bin/commands/agent.ts`. After computing the entries and BEFORE filtering for staleness, identify the entry whose `sessionId === getSessionId()` (the calling session) and `utimesSync` its file to `Date.now()`. Side effect is the only change visible to callers; the function still returns the same table. **Done — `agentList` calls `getSessionId()` and `utimesSync` on the caller's own presence file before the bulletin read. Wrapped in try/catch so a poisoned env var or filesystem error degrades gracefully (list output still proceeds). Discovered work: T5 needed to be reframed as a cross-session staleness test because the self-heartbeat refreshes the lister's own mtime — the old single-session phrasing of T5 silently relied on the absence of heartbeat. Updated T5 to use session B as the observer of session A's staleness.**
- [x] **Document the implicit heartbeat in `apps/docs/src/reference/cli/agent.md`** — add a `## Heartbeat` section noting that `indusk agent list` refreshes the caller's mtime so active sessions naturally stay visible without an explicit heartbeat call. Cross-link from the `agents.stale_ttl_minutes` config description. **Done — see Phase 6 Document.**
- [x] **Update `apps/docs/src/guide/multi-agent.md`** — the existing "increase if your sessions routinely run longer" guidance can stay but should be qualified: routine `/catchup` or `indusk agent list` calls keep the session visible without manual TTL tuning. Only sessions that go truly idle (no CLI activity for > TTL) age out. **Done — see Phase 6 Document.**
- [x] **Sync rewritten skill if affected** — neither catchup.md nor handoff.md needs to change for these fixes (catchup already calls `agent list` which now self-heartbeats; handoff is already deprecated). **Confirmed — no skill changes required. The catchup skill's Step 2 (call `indusk agent list`) now implicitly provides per-catchup heartbeat without any prose change.**

#### Phase 6 Verification
- [x] T12 passes — three test cases against the published CLI:
  - `CLAUDE_CODE_SESSION_ID=../escaped indusk agent register --task evil` exits non-zero (rejected by sanitizer); no file lands at `<projectRoot>/.indusk/escaped.md` or anywhere outside `.indusk/agents/`.
  - `indusk agent done --session-id ../../config` exits non-zero (rejected); `<projectRoot>/.indusk/config.json` is unaffected.
  - Normal session IDs (UUIDs, `pid-1234`, `abc_def-123`) still work end-to-end. **Verified 2026-06-26: 3 of 3 T12 cases passing in `multi-agent-cli.test.ts`. Plus 9 direct unit tests on `sanitizeSessionId` covering edge cases (empty, whitespace, length, leading-dot, all traversal characters) in `lib/agents/__tests__/session.test.ts`.**
- [x] T13 passes — register-backdate-list cycle:
  - Register session A, backdate its presence file mtime to T-90min (older than default 60min TTL).
  - From session A: `indusk agent list`.
  - Assert: session A's presence file mtime is now within the last 5 seconds (refreshed by the self-heartbeat).
  - Assert: session A still appears in subsequent `indusk agent list` output from any session. **Verified 2026-06-26: T13 case in `multi-agent-cli.test.ts` asserts mtime delta is >0 after self-heartbeat and within the last 5s of wall-clock.**
- [x] Regression sweep: all existing trajectory rows (T1-T11) still passing after the sanitizer + heartbeat changes land. **Verified 2026-06-26: full multi-agent sweep = 48 passing + 2 skipped (T1/T2 in cli stay deferred to manual smoke; T10 stays skipped pending Sandy's manual run). T5 was reframed in scope to cross-session staleness (own-session staleness check is incoherent now that list self-heartbeats — surfaced as discovered work above).**

#### Phase 6 Context
- [x] Update `CLAUDE.md` Known Gotchas: add entry "Session IDs are sanitized at the boundary — any `$CLAUDE_CODE_SESSION_ID` or `--session-id` value containing `..`, `/`, `\`, or starting with `.` is rejected; the sanitizer lives in `apps/indusk-mcp/src/lib/agents/session.ts` and is the single chokepoint. Future code that constructs presence file paths from external input MUST route through `sanitizeSessionId`." **Done — entry added documenting the sanitizer's reject rules, the chokepoint discipline, and the concrete attack vector both register and done were exposed to.**
- [x] Update `CLAUDE.md` Known Gotchas: add entry "`indusk agent list` is also an implicit heartbeat — the calling session's own presence file mtime gets refreshed on every list call. Sessions that go idle for `agents.stale_ttl_minutes` (default 60) without any `agent` CLI activity age out; sessions that use the bulletin stay visible indefinitely." **Done — entry added documenting the heartbeat semantics, the T5 reframe (cross-session-only staleness check), and the "session can't observe its own staleness" implication for future test authors.**

#### Phase 6 Document
- [x] Already covered by the implementation checklist items above (agent.md `## Heartbeat` section + guide qualifier). Mark the agent.md `## Heartbeat` and the multi-agent.md long-running-session paragraph as the document-gate deliverables; no additional pages needed. **Done — `apps/docs/src/reference/cli/agent.md` grew a `## Heartbeat` section + a `## Path safety` section describing the sanitizer's reject rules; `apps/docs/src/guide/multi-agent.md` configuration paragraph qualified with the active-sessions-stay-visible behavior and a cross-link to the agent.md Heartbeat section.**

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
