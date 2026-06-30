---
title: "Cursor support for InDusk — Brief"
date: 2026-06-28
status: draft
audience: Sandy
---

# Cursor support for InDusk — Brief

## Problem

InDusk is currently Claude Code-tied. The skills system, hooks-based gate enforcement, presence-bulletin env var, and eval-agent subprocess all assume Claude Code as the runtime. Sandy is starting a new job (2026-06-29) where the team uses Cursor. Without portability, the choice is binary: keep using InDusk only on personal/dogfood projects and lose its discipline at the job, OR drop InDusk entirely and lose the planning/work/retro lifecycle on every project.

The Cursor hooks API research (see `research.md`) shows that Cursor's hook surface is a near-superset of what InDusk currently uses on Claude Code. The port is mostly translation work, not capability work. The right move is to make InDusk IDE-aware rather than Claude-Code-only.

## Proposed Direction

Add Cursor as a first-class second IDE alongside Claude Code. **Single canonical source for skills, hooks, and conventions in `apps/indusk-mcp/`** — `init` writes the right shape for both IDEs. Hook scripts get a small input-shape adapter so the same scripts run under both IDEs. `sessionStart` in Cursor transparently injects `CLAUDE_CODE_SESSION_ID` so the multi-agent presence layer works without changes.

Two surfaces land in `init`:
- `.claude/settings.json` + `.claude/skills/` (today; unchanged)
- `.cursor/hooks.json` + `.cursor/commands/` + `.cursor/rules/` (new)

`.mcp.json` is shared via symlink (`.cursor/mcp.json` → `.mcp.json`). MCP tools work natively in Cursor without modification.

The eval agent stays on the Claude CLI as a subprocess for v1 — the cleanest path since `cursor-agent` CLI parity with `--mcp-config` / `--resume` is unconfirmed. Cursor users keep Claude CLI installed alongside Cursor; that's the same machine setup Sandy already has.

## Context

The cursor-support work is enabled by the section-shape rework that just shipped on main (`handoff-multi-agent-section-shape` merged via `0724fc68`). Session presence now lives in per-agent sections inside `.indusk/current.md` rather than per-session files; the `mcp__indusk__update_current_section` MCP tool is the explicit write surface. This abstracts presence away from filesystem layout, so Cursor's `sessionStart`-injected `CLAUDE_CODE_SESSION_ID` flows through the existing helpers without further work.

InDusk's hook scripts already speak the exact protocol Cursor expects: stdio JSON in/out, exit code 0 = ok, exit code 2 = block, `failClosed` opt-in for security-critical hooks. The `CLAUDE_PROJECT_DIR` env var that the hook scripts read is provided by Cursor as an alias. The translation effort is concentrated in three places:

1. Config shape — `.cursor/hooks.json` mirrors the `.claude/settings.json` hooks block with different event names and matcher syntax.
2. Input shape adapter — Cursor's hook input differs from Claude Code's in field names (`tool_name` values like `Shell` vs `Bash`) and per-tool `tool_input` schema. A small normalizer (~50 lines) runs at the top of each hook script.
3. Skills → Commands + Rules — process skills become `.cursor/commands/*.md`; domain skills become `.cursor/rules/*.mdc` with file-type globs.

The full lifecycle of porting concerns and the prior-art evidence is in `research.md`.

## Scope

### In Scope
- New `.cursor/hooks.json` written by `indusk init` and `indusk update`, mirroring `.claude/settings.json` hooks.
- New `.cursor/commands/{name}.md` generated from `apps/indusk-mcp/skills/{name}.md` for process skills (planner, work, verify, document, retrospective, falsify, catchup, handoff, highlight).
- New `.cursor/rules/{name}.mdc` generated for domain skills (typescript, testing, git, otel, etc.) with appropriate file-type globs.
- Symlinked `.cursor/mcp.json` → `.mcp.json` so MCP works in Cursor.
- New `apps/indusk-mcp/hooks/_adapter.js` shim providing a unified `parseHookInput(json)` helper that returns the same shape across Claude Code + Cursor inputs.
- Existing hook scripts (`check-gates.js`, `validate-impl-structure.js`, `eval-trigger.js`, `check-catchup.js`) updated to use the adapter; behavior unchanged when invoked from Claude Code.
- `sessionStart` hook script at `.cursor/hooks/session-start.sh` that returns `{"env": {"CLAUDE_CODE_SESSION_ID": "<session_id>"}}`.
- `eval-trigger.js` updated to also fire from `afterShellExecution` matching `git commit` (in addition to the existing Claude Code wiring).
- User-facing docs at `apps/docs/src/guide/cursor.md` walking through the dual-IDE setup, the Commands/Rules conventions, and the cloud-agent caveats.
- `indusk init` accepts `--ide claude|cursor|both` (default `both` — writes both surfaces).

### Out of Scope
- **`cursor-agent` CLI integration for the eval agent.** Stays on `claude --print` as the eval subprocess for v1. Configurable later when a Cursor headless CLI with `--mcp-config` parity is confirmed.
- **General IDE adapter abstraction for hypothetical future IDEs.** v1 ships a Cursor-specific port. If Continue / Aider / Windsurf / JetBrains-AI demand follows, a later plan extracts the adapter pattern from the diff.
- **Team-level hook distribution via Cursor's web dashboard.** Project-level `.cursor/hooks.json` is sufficient for v1; team-distribution is an enterprise feature most users won't need.
- **Cloud Background Agents session-ID injection.** Cloud agents don't fire `sessionStart`, so presence falls back to `pid-<N>` there. Documented as a known limitation; full cloud parity is a separate plan.
- **Tab hook integration.** `beforeTabFileRead` / `afterTabFileEdit` could enable redaction / Tab-specific formatting; not load-bearing for InDusk's discipline. Defer.

## Success Criteria

A developer with both Claude Code and Cursor installed can:

1. Run `indusk init` in a new project; both `.claude/` and `.cursor/` surfaces land correctly.
2. Open the same project in Cursor; `/catchup` runs and surfaces other agents (via `indusk agent list`).
3. Edit `impl.md` with bad structure in Cursor; `preToolUse` hook blocks the edit with the same message Claude Code would show.
4. Commit in Cursor; eval agent fires (via `afterShellExecution` matcher) and scores the commit; highlights drain to Graphiti.
5. Call `mcp__indusk__update_current_section` from a Cursor agent; the section lands in `.indusk/current.md` with the Cursor session's ID (injected via `sessionStart`).
6. Open the project simultaneously in Claude Code + Cursor; both sessions show up in each other's `indusk agent list` (the bulletin is IDE-agnostic).

## Depends On

- `handoff-multi-agent-section-shape` (shipped, merged via `0724fc68`) — provides the section-shape multi-agent presence that's IDE-agnostic.
- `git-only-substrate` (shipped 1.31.0) — Cursor's hook env doesn't expose any jj signal; git-only is the only sane shared-substrate.
- Spike on `cursor-agent` CLI capabilities — needed before scoping eval-agent driver work into a future plan; not blocking for this brief.

## Blocks

- Future plan: `eval-agent-cursor-driver` (only meaningful after spike confirms or denies CLI capabilities).
- Future plan: `cloud-background-agent-parity` (only meaningful if Sandy's team uses Cursor Background Agents heavily).
- Future plan: `ide-adapter-abstraction` (only meaningful if a third IDE gets demand).

## Effort

~3-4 days of focused work, contingent on:
- Hook input-shape adapter is the biggest unknown (real wire-protocol edges may not be in the doc).
- Skills → Commands translation is mechanical but tedious (one transform per skill type).
- Doc + verification work scales with how much team-adoption Sandy wants to enable.

Realistic phasing:
- Phase 1 — spike + adapter scaffolding (1 day)
- Phase 2 — hook config + scripts ported (1 day)
- Phase 3 — skills → Commands + Rules generation (1 day)
- Phase 4 — init/update integration + tests + docs (1 day)

A `cursor-extension` plan would naturally split along these phases.

## Open Questions for the ADR

1. **Cursor-specific port vs general IDE adapter pattern?** v1 ships Cursor-specific; do we explicitly architect for portability (extract an adapter interface) or wait until a third IDE shows up?
2. **`indusk init --ide` default — `both` or `auto-detect`?** "Both" is safest (developer can use either IDE); "auto-detect" (look for `~/.cursor/` or `~/Library/.../Cursor/`) is friendlier. Or a `~/.indusk/preferences.json` opt-in.
3. **Skills as Commands vs Rules — explicit per-skill mapping?** Worth a small table in the ADR so the generation step is mechanical, not interpretive.
4. **What happens when `.cursor/hooks.json` and `.claude/settings.json` drift?** If a developer hand-edits one, do we resync from the source on next `indusk update`, or treat both as user-owned and only update unchanged content? Same problem we already solved for skills auto-sync; reuse the pattern.
5. **Cloud Background Agents fallback — explicit warning?** Should `indusk agent list` print a notice when running in a Cursor cloud agent ("session-ID falls back to pid-<N>; cross-machine visibility limited")?
