# Handoff

**Date:** 2026-04-20
**Session:** Shipped admin-ui-hosting Phase 5 (1.27.0 → 1.27.3 including Phase 6 UX polish: scorecards project-siloing + research section + brief collapsible + stale-nav-links bugfix) then ran the full planner lifecycle for `local-telemetry` (research + brief + test-plan + ADR + impl, all accepted, impl approved ready for /work) and the full planner lifecycle + /work Phase 1 for `falsify-phase-authoring` (bugfix workflow, 1.27.4 ready to publish). Ended before publishing 1.27.4 and before the first dogfood of the new falsify flow on admin-ui-hosting.

## What Was Being Worked On

Three plans in this session, each at a different state:

1. **admin-ui-hosting** — shipped 1.27.0 → 1.27.1 (restart) → 1.27.2 (scorecards siloing + research + brief collapsible) → 1.27.3 (strip stale top-level nav links). Phase 6 fully closed. Live smoke passed on dusk + Numero. Plan status still `in-progress` pending `/falsify` + `/retrospective` under the NEW flow (which ships in 1.27.4).

2. **local-telemetry** — full planner lifecycle completed this session. research.md + brief.md (accepted) + test-plan.md (accepted, 22 assertions) + adr.md (accepted) + impl.md (approved, 7 phases, 22 trajectory rows all Phase 0). Machine-global daemon following admin-UI 1.27.x pattern: Jaeger + OTel Collector + SQLite log sink in one container, `indusk telemetry start/stop/restart/status` + `tail/trace/services/reset` CLI, MCP tools (`get_recent_spans` / `get_trace` / `get_services` / `tail_logs`). Phase 1 is a hands-on spike producing `spike-findings.md`. Ready for `/work local-telemetry`.

3. **falsify-phase-authoring** (NEW this session) — bugfix workflow: brief + test-plan + impl, all accepted/approved. **Phase 1 fully closed** (7 per-item jj commits): rewrote `apps/indusk-mcp/skills/falsify.md` + `.claude/skills/falsify/SKILL.md` to phase-authoring behavior, updated `apps/indusk-docs/src/guide/falsification-ritual.md` with phase-authoring walkthrough + legacy-plans section, updated `apps/indusk-mcp/skills/retrospective.md` + `.claude/skills/retrospective/SKILL.md` Step 0 gate to accept "all impl phases terminal" alongside legacy `isFalsificationComplete`, wrote regression test `apps/indusk-mcp/src/__tests__/retrospective-gate-backcompat.test.ts` (T6 — 3/3 passing), appended CLAUDE.md Conventions entry. **Phase 2 agent-side done**: bumped `apps/indusk-mcp/package.json` → 1.27.4, added changelog entry.

## Where It Stopped

`falsify-phase-authoring` Phase 2 is paused at the publish step. The agent-side work is complete; user needs to:

1. `cd ~/code/sandbox/dusk/apps/indusk-mcp && pnpm publish` (ships 1.27.4 with the new `/falsify` behavior)
2. `npm i -g @infinitedusky/indusk-mcp@1.27.4`
3. Optionally: `indusk ui restart` if the daemon is running (it'll pick up the new admin bundle, though admin-UI didn't change in this version)

Then the dogfood on admin-ui-hosting begins (which closes T1–T5 for the falsify-phase-authoring plan AND unblocks admin-ui-hosting's retrospective queue).

## What's Next

In this order:

1. **Publish 1.27.4** + install globally (user action, commands above).
2. **First dogfood of the new flow**: run `/falsify admin-ui-hosting`. Expect it to append a `### Phase 8: Falsification — {summary}` to `admin-ui-hosting/impl.md` with trajectory rows for any hypotheses + fix items + gates. **No test files should be created, no test runs should happen.** Plan status stays `in-progress`. Closes T1, T2, T3 of the falsify-phase-authoring plan.
3. **Work the authored Phase 8**: `/work admin-ui-hosting` picks up Phase 8, authors writable-at-phase tests red at phase start, closes normally. Closes T4.
4. **Retrospective admin-ui-hosting**: `/retrospective admin-ui-hosting` — the Step 0 gate should pass via "all impl phases terminal" WITHOUT needing a `falsification.md` file in the plan folder. Closes T5 + archives admin-ui-hosting. Closes falsify-phase-authoring Phase 2 + unblocks its own retrospective.
5. **Repeat for indusk-admin-ui** (impl in-progress per CLAUDE.md; shipped in 1.26.0): `/falsify` → `/work` → `/retrospective`.
6. **Repeat for eval-agent-mcp-access** (impl in-progress per CLAUDE.md; shipped in 1.23.x): same sequence.
7. **`/retrospective falsify-phase-authoring`** once its Phase 2 is fully terminal (via admin-ui-hosting retrospective proving T5).
8. **`/work local-telemetry`** — Phase 1 is a hands-on spike (Jaeger all-in-one + OTel Collector + SQLite sink prototype + latency measurement + container-packaging/distribution decisions). Output is `spike-findings.md` which also seeds the `telemetry-watcher-agent` plan.

## Open Issues

- **1.27.4 not published yet.** Agent-side work is committed (version bump + changelog + skill rewrites + regression test) but `pnpm publish` not run. Everything that has to ship for the new `/falsify` flow is in place; user just needs to run the publish command.
- **T4 and T5 of falsify-phase-authoring are `planned`** pending the admin-ui-hosting dogfood closing. They flip after `/work admin-ui-hosting` Phase 8 closes (T4) and `/retrospective admin-ui-hosting` runs (T5). This is expected — the plan stays `in-progress` until those transitive verifications flip.
- **`local-telemetry` impl is `approved` status** — waiting for `/work` to be invoked. Phase 1 spike is deliberately hands-on; make sure OrbStack/Docker is available before starting since the spike pulls container images.
- **indusk-v2-dawn rebrand**: user confirmed the v2 product is called "Dawn" (future versions: Dawn V3, Dawn V4). InDusk stays the parent project/company name. Highlight captured (h-20260420-007); no planning folder work yet since `indusk-v2-dawn` is still in `research` stage.

## Decisions Made This Session

1. **local-telemetry runs as a machine-global daemon, not bundled in indusk-infra.** The admin-UI 1.27.x daemon pattern is the reuse — `indusk telemetry start/stop/restart/status`, metadata at `~/.indusk/telemetry.{pid,json,log}`, registry at `~/.indusk/telemetry/projects.json`. Decoupling telemetry lifecycle from graph-infra lifecycle avoids "reindexing the graph bounces my trace buffer." Captured in adr.md + CLAUDE.md Key Decisions.

2. **OTel Collector is structural, not optional.** Per-service sidecar exporters would duplicate batching/retry/filtering config across every service. Collector centralizes that once; future downstream exporters (sampling to Dash0, OpenInference for LLM spans) bolt onto Collector without touching services.

3. **Logs are in v1, not punted to v2.** Half of "why did this fail" diagnosis is log context; an MCP tool named `tail_logs` returning "not yet implemented" undermines the plan's own justification. SQLite log sink schema `(timestamp, service, level, trace_id, span_id, body, attributes_json)` with rolling retention.

4. **`/falsify` becomes a phase-authoring action** (not a test-running ritual). Captured in falsify-phase-authoring plan's brief + ADR-equivalent in the skill file. Three rejections: inline test running (removed; `/work` runs tests at phase start), three-outcome branching per hypothesis (removed; in-scope fixes become items, out-of-scope hypotheses are not authored), sidecar `falsification.md` log (removed for new plans; kept for backcompat on legacy plans).

5. **Container packaging + image distribution for local-telemetry deferred to Phase 1 spike.** Supervisord-single-image vs docker-compose-multi-image + pull-from-ghcr vs local-build-from-bundled-Dockerfile — both decisions need hands-on measurement before committing.

6. **Rebrand: dusk-v2 plan → indusk-v2-dawn; the v2 product line is called "Dawn".** Not yet formalized beyond the highlight + the renamed planning folder; `indusk-v2-dawn/research.md` will need to consume this when it moves forward.

## Watch Out For

- **Do NOT run `/falsify` with intent to execute tests inline** from 1.27.4 onward. The skill is now phase-authoring only. The updated `apps/indusk-mcp/skills/falsify.md` spells out `## What you do not do in the ritual` — no test files, no test runs, no three-way outcome picking. If you feel the urge, re-read that section.
- **`/retrospective`'s Step 0 gate in 1.27.4 accepts all THREE pass conditions:** (a) all impl phases terminal, (b) legacy `isFalsificationComplete(planRoot)` via `falsification.md`, (c) `falsification: skipped` + `falsification_reason` frontmatter. The skill file lists them in this order; respect it.
- **Phase 8 of admin-ui-hosting is yet to be authored** — the first use of the new flow. Any hypotheses formed during `/falsify admin-ui-hosting` become trajectory rows + impl items in that phase.
- **local-telemetry Phase 1 spike is deliberate hands-on work** — don't skip it or treat it as prose research. The validator accepted all Phase 0 writable rows, but actual container packaging + image distribution decisions can only be made by running the prototype.
- **The `falsification/log.ts` library is unchanged and STAYS unchanged.** Backwards compat for archived plans (e.g., `.indusk/planning/archive/falsification-ritual/falsification.md`). Do not delete or deprecate it — the regression test proves the legacy path still works.
- **admin-ui-hosting's impl.md trajectory uses T-prefixed IDs (T1–T22 across Phases 1–6);** the NEW Phase 8 falsification rows continue numbering from T22 upward (T23+). Don't reset to T1.
- **Three pending retros queue up behind this session's work**: admin-ui-hosting → indusk-admin-ui → eval-agent-mcp-access. Each gets the full new-flow treatment: `/falsify → /work → /retrospective`. If any of them surfaces a fix-in-scope change that requires another ship, version bumps proceed 1.27.5, 1.27.6, etc.
- **Session-long jj history**: ~20 per-item commits this session spanning admin-ui-hosting Phase 5 + Phase 6 + 1.27.1 + 1.27.3 + falsify-phase-authoring Phase 1 + Phase 2 version bump. `jj log` to see the chain; none of it is pushed anywhere (that's user's call).

## Catchup Status
- [x] mcp-ready
- [x] handoff
- [x] lessons
- [x] skills
- [x] health
- [x] context
- [x] plans
- [x] extensions
- [x] graph
- [x] graphiti
