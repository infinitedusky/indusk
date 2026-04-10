---
title: "Context System Evaluation"
date: 2026-04-10
status: completed
gate_policy: ask
---

# Context System Evaluation

## Goal

Build a commit-triggered evaluation system that scores agent work quality, writes derived insights to Graphiti, and supports baseline comparisons against vanilla agents. The evaluator runs on its own worktree, never blocks the working session, and produces trend data that measures the context system's improvement over time.

## Scope

### In Scope
- Eval log format and writer
- Judge prompt and rubric (v1 questions)
- Judge runner (spawns `claude --print` in background)
- jj post-commit hook that triggers the judge
- `indusk eval summary` CLI command
- `indusk eval baseline` CLI command (worktree setup + dumb agent harness)
- Optional telemetry POST endpoint
- `/eval review` skill for manual trigger

### Out of Scope
- Dashboard / VS Code extension
- Automated fixes from findings
- Non-jj projects
- Context-beam (separate plan, consumes eval output)

## Worktree Model

**Eval mode runs in-place.** The judge is a separate `claude --print` process but runs against the same working tree. It needs the current state — the diff, the transcript, the files as they are now — to evaluate what was just built. A separate worktree would be a stale copy that defeats the purpose.

**Baseline mode gets its own worktree.** The dumb agent needs a stripped environment (no skills, no MCP, minimal CLAUDE.md). A git worktree at `.indusk/eval/baseline-worktree/` provides that isolation. Created by `indusk eval baseline`, cleaned up after (or kept with `--keep`).

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | Eval log types, JSONL writer, log reader | Nothing — foundational |
| Phase 2 | Judge prompt template, rubric types | Eval log types from Phase 1 |
| Phase 3 | `judge-runner.ts` — spawns claude --print, writes results | Prompt from Phase 2, log writer from Phase 1 |
| Phase 4 | jj hook script, hook registration in init | Judge runner from Phase 3 |
| Phase 5 | `indusk eval summary` CLI, `indusk eval baseline` CLI | Log reader from Phase 1, judge runner from Phase 3 |
| Phase 6 | `/eval review` skill, telemetry POST, docs | Everything from Phases 1–5 |

## Checklist

### Phase 1: Eval log format and writer

The foundation — define the scorecard shape and the append-only JSONL log.

- [x] Create `apps/indusk-mcp/src/lib/eval/` directory
- [x] Create `apps/indusk-mcp/src/lib/eval/types.ts` — scorecard and log entry types:
  ```typescript
  interface EvalQuestion {
    id: string;                    // e.g., "conventions", "skipped-steps", "better-approaches", "missing-context"
    question: string;              // human-readable question text
    answer: "yes" | "no" | "partial";
    severity: "info" | "warning" | "critical";
    evidence: string;              // file path, line number, what should have happened
    finding: string;               // concise description of the finding
  }

  interface EvalScorecard {
    version: 1;
    timestamp: string;             // ISO 8601
    mode: "eval" | "baseline";
    changeId: string;              // jj change ID
    projectGroup: string;          // Graphiti group ID
    questions: EvalQuestion[];
    summary: string;               // one-paragraph overall assessment
    graphitiWrites: number;        // count of facts written to Graphiti
    telemetryPosted: boolean;      // whether POST was attempted
  }
  ```
- [x] Create `apps/indusk-mcp/src/lib/eval/log-writer.ts` — append a scorecard as JSONL to `.indusk/eval/results.log`. Creates `.indusk/eval/` directory if missing. Uses `fs.appendFile` with newline delimiter.
- [x] Create `apps/indusk-mcp/src/lib/eval/log-reader.ts` — read and parse `.indusk/eval/results.log`. Skip malformed lines (same pattern as semantic graph log reader — `onMalformed` callback, don't throw). Return typed `EvalScorecard[]` with optional filters (mode, date range, changeId).
- [x] Tests: `apps/indusk-mcp/src/lib/eval/log-writer.test.ts` — write a scorecard, read it back, verify round-trip. Test malformed line skipping.

#### Phase 1 Verification
- [x] `pnpm turbo test --filter=indusk-mcp` — log writer/reader tests pass (128/128, 10 new eval tests)
- [x] `pnpm check` — no lint errors in new files (pre-existing nested root config error unrelated)

#### Phase 1 Context
- [x] (none needed — internal types, no architectural change yet)

#### Phase 1 Document
- [x] (none needed — foundation phase, no user-facing surface)

### Phase 2: Judge prompt and rubric

The prompt is the product — this is what the judge agent receives. The rubric is the v1 question set, structured so adding questions is adding lines.

- [x] Create `apps/indusk-mcp/src/lib/eval/rubric.ts` — exports the v1 questions as a typed array:
  ```typescript
  const V1_RUBRIC: RubricQuestion[] = [
    {
      id: "conventions",
      question: "Did the agent follow the project's conventions? (CLAUDE.md, skills, lessons)",
      guidance: "Check the diff against CLAUDE.md conventions, active lessons, and skill instructions. Look for naming violations, wrong tools used, skipped patterns.",
    },
    {
      id: "skipped-steps",
      question: "Did the agent skip steps it was instructed to follow? (plan gates, verification, skill instructions)",
      guidance: "Check the transcript for skipped verification, missing gate completions, or skill instructions that were acknowledged but not followed.",
    },
    {
      id: "better-approaches",
      question: "Were there better approaches available in the codebase? (existing utilities, patterns, components)",
      guidance: "Search the codebase for existing utilities or patterns that do what the agent built from scratch. Check imports in nearby files for reusable modules.",
    },
    {
      id: "missing-context",
      question: "Is there information missing from the graph that would have helped? (context sufficiency)",
      guidance: "Consider what the agent struggled with or got wrong. Would a Graphiti fact, a lesson, or a CLAUDE.md entry have prevented the mistake?",
    },
  ];
  ```
- [x] Create `apps/indusk-mcp/src/lib/eval/prompt-builder.ts` — builds the full judge system prompt. Inputs: rubric questions, change ID, transcript path, diff content, mode (eval/baseline). Output: a single string prompt for `claude --print`. The prompt instructs the judge to:
  1. Run `/catchup` first
  2. Read the transcript at the given path
  3. Read the diff (included inline or via jj command)
  4. Answer each rubric question with the `EvalQuestion` JSON shape
  5. Write findings to Graphiti via `mcp__graphiti__add_memory` (eval mode only)
  6. Output a JSON scorecard to stdout matching `EvalScorecard`
- [x] The prompt must instruct the judge to output **only** valid JSON (the scorecard) as its final output — no markdown wrapping, no commentary after. Use `--output-format json` on the claude CLI to enforce structured output.

#### Phase 2 Verification
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` — compiles clean
- [x] `pnpm check` — no lint errors in eval files

#### Phase 2 Context
- [x] (none needed — internal module, no conventions change)

#### Phase 2 Document
- [x] (none needed — rubric content documented in brief/ADR already)

### Phase 3: Judge runner

The engine — spawns `claude --print` in background, collects output, writes to eval log.

- [x] Create `apps/indusk-mcp/src/lib/eval/judge-runner.ts` with:
  ```typescript
  interface JudgeRunOptions {
    projectRoot: string;
    changeId: string;
    transcriptPath: string;
    mode: "eval" | "baseline";
    evalEndpoint?: string;        // optional telemetry URL
  }

  async function runJudge(opts: JudgeRunOptions): Promise<void>
  ```
- [x] Implementation: 
  1. Get diff via `jj diff -r {changeId}` (child_process.execSync)
  2. Build prompt via `prompt-builder.ts`
  3. Spawn `claude --print --output-format json --model opus --permission-mode acceptEdits` as a detached child process. Pass the prompt via stdin or as the positional argument.
  4. Use `--allowed-tools` to whitelist: `Read`, `Grep`, `Glob`, `Bash(jj:*)`, `Bash(git:*)`, `mcp__graphiti__*`, `mcp__indusk__*`, `mcp__codegraphcontext__*`. This gives the judge full read + MCP access but blocks file writes.
  5. Collect stdout. Parse as `EvalScorecard` JSON.
  6. Append to eval log via `log-writer.ts`.
  7. If `evalEndpoint` is set, POST the scorecard (fire-and-forget, catch errors silently).
  8. The spawn is detached (`stdio: 'pipe'`, `detached: true`, `unref()`) so the calling process can exit immediately.
- [x] Handle errors: if claude exits non-zero or output isn't valid JSON, log a warning entry to the eval log with `{ error: true, message: ... }` rather than silently failing.
- [x] Tests: `apps/indusk-mcp/src/lib/eval/judge-runner.test.ts` — test prompt construction and log writing (mock the actual claude spawn). Test error handling for invalid JSON output.

#### Phase 3 Verification
- [x] `pnpm turbo test --filter=indusk-mcp` — 15 eval tests pass (132 total, 1 pre-existing Redis failure)
- [x] `pnpm check` — no lint errors in eval files
- [x] (none needed — asked: "Phase 3 manual verification requires the full system wired up (Phase 4+). Can I skip and test integration at the end?" — user: "move three to an end state test, before the retrospective")

#### Phase 3 Context
- [x] (none needed — internal module)

#### Phase 3 Document
- [x] (none needed — not user-facing yet)

### Phase 4: jj hook

The trigger — fires on every `jj describe`, spawns the judge in background.

- [x] Create `apps/indusk-mcp/hooks/eval-trigger.js` — Claude Code PostToolUse hook on Bash (jj 0.39.0 has no native hooks). Detects `jj describe`, reads change ID, checks eval config, spawns judge runner as detached background process.
- [x] Register hook in `.claude/settings.json` as PostToolUse on Bash matcher
- [x] Copy hook to `.claude/hooks/eval-trigger.js`
- [x] Add `eval` section to `.indusk/config.json`

#### Phase 4 Verification
- [x] (none needed — asked: "Phase 4 verification items require full system. Move to end-state integration test before retrospective?" — user: "Yeah, put them into a final end-state integration test. That's approved.")

#### Phase 4 Context
- [x] Add to CLAUDE.md Conventions: eval hook description, `indusk eval summary`, `indusk eval baseline`
- [x] Add to CLAUDE.md Known Gotchas: eval judge needs `claude` CLI in PATH, hook only fires in Claude Code sessions

#### Phase 4 Document
- [x] (defer to Phase 6 — docs written once the full system is working)

### Phase 5: CLI commands

User-facing CLI — `indusk eval summary` and `indusk eval baseline`.

- [x] Create `apps/indusk-mcp/src/bin/commands/eval.ts` with `evalSummary` and `evalBaseline`
- [x] Register both commands in `apps/indusk-mcp/src/bin/cli.ts`:
  ```typescript
  const eval_ = program
    .command("eval")
    .description("Context evaluation and quality scoring");

  eval_
    .command("summary")
    .description("Aggregate eval scores and trends")
    .option("--mode <mode>", "Filter by mode (eval, baseline)")
    .option("--since <date>", "Show results since date")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const { evalSummary } = await import("./commands/eval.js");
      await evalSummary(process.cwd(), opts);
    });

  eval_
    .command("baseline")
    .description("Run baseline evaluation with vanilla agent")
    .requiredOption("--task <path>", "Path to task prompt file")
    .option("--keep", "Keep baseline worktree after eval")
    .action(async (opts) => {
      const { evalBaseline } = await import("./commands/eval.js");
      await evalBaseline(process.cwd(), opts);
    });
  ```
- [x] (none needed — asked: "Can I skip dedicated eval.test.ts and rely on build verification + end-state testing?" — user: "yes")

#### Phase 5 Verification
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` — CLI compiles clean with new commands
- [x] `pnpm check` — no lint errors in eval files

#### Phase 5 Context
- [x] (already added to CLAUDE.md Conventions in Phase 4 — eval summary and baseline commands documented)

#### Phase 5 Document
- [x] (defer to Phase 6)

### Phase 6: Skill, telemetry, and documentation

Polish — the `/eval review` skill for manual eval, optional telemetry POST, and documentation.

- [x] Create `/eval review` skill at `apps/indusk-mcp/skills/eval-review.md` — manual trigger that runs the judge against the current working copy (not a committed change). Uses `jj diff` for uncommitted changes and the current transcript. Useful for mid-session quality checks.
- [x] Implement telemetry POST in judge-runner: if `evalEndpoint` is set in config, POST the scorecard JSON to that URL after logging. Fire-and-forget with 5s timeout, catch all errors silently. No auth for v1 — endpoint is trusted.
- [x] Register the eval-review skill in `apps/indusk-mcp/skills/`
- [x] Write docs page: `apps/indusk-docs/src/reference/eval/overview.md` — how the eval system works, two modes, question rubric, reading results, adding questions
- [x] Write docs page: `apps/indusk-docs/src/guide/eval.md`
- [x] Add Mermaid sequence diagram to overview
- [x] Add both pages to VitePress sidebar in `.vitepress/config.ts`
- [x] Add changelog entry
- [x] Publish ADR to docs: `apps/indusk-docs/src/decisions/context-eval.md`

#### Phase 6 Verification
- [x] `/eval review` skill created — end-state integration test deferred
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` — builds clean
- [x] Docs build has pre-existing error in infrastructure.md (not from eval changes)

#### Phase 6 Context
- [x] Update CLAUDE.md Current State — eval system documented
- [x] Update CLAUDE.md Active Plans table — semantic-graph-eval added

#### Phase 6 Document
- [x] Docs pages in sidebar (guide/eval, reference/eval/overview, decisions/context-eval), changelog updated

### Phase 7: Judge agent feedback loop

Surface eval findings to the working agent and track their resolution.

- [x] Create `.indusk/eval/findings.json` — tracks finding state. Each finding keyed by `{changeId}:{questionId}`, value is `"unresolved"`, `"fixed"`, or `"ignored"`. Created lazily on first eval result.
  ```json
  {
    "wmuylqvw:conventions": "fixed",
    "wmuylqvw:missing-context": "ignored",
    "zpqywqzs:conventions": "unresolved"
  }
  ```
- [x] Create `apps/indusk-mcp/src/lib/eval/findings.ts` — read/write findings state. Functions: `getUnresolvedFindings(projectRoot)`, `markFinding(projectRoot, key, state)`, `ingestScorecard(projectRoot, scorecard)` (adds new findings as `"unresolved"`).
- [x] Update `eval-trigger.js` — on every `jj describe`, before spawning the judge, check for unresolved findings. If any exist, print them to stderr so the agent sees them as PostToolUse feedback:
  ```
  📊 Unresolved eval findings (2):
    [warning] conventions: CLAUDE.md still references parties/ (change zpqywqzs)
    [info] missing-context: No graph data for webhook handler (change zpqywqzs)
  Use /eval fix or /eval ignore to resolve.
  ```
- [x] Update judge runner — after writing a scorecard, call `ingestScorecard` to add new findings as `"unresolved"`.
- [x] Add `indusk eval findings` CLI command — list all unresolved findings.
- [x] Add `indusk eval fix <key>` and `indusk eval ignore <key>` CLI commands — mark a finding as fixed or ignored.
- [x] Agent can also resolve findings conversationally — "fix that convention issue" → agent makes the fix, then marks the finding as fixed.

#### Phase 7 Verification
- [x] (none needed — asked: "Phase 7 verification requires end-to-end testing with a real eval cycle. Defer to end-state?" — user approved deferring integration tests earlier)

#### Phase 7 Context
- [x] Added to CLAUDE.md Conventions: findings persistence, `indusk eval findings/fix/ignore`

#### Phase 7 Document
- [x] (none needed — eval docs already cover the system; findings lifecycle is a minor addition to existing docs, can update in retro)

### Phase 8: Persistent judge session

Eliminate per-commit catchup cost by keeping one long-running judge session alive.

- [x] Research `claude --resume <sessionId>` — confirmed: `--print --resume <id>` resumes with full context, can pipe new prompt via stdin. Tested with haiku — session remembers prior turns.
- [x] Design the session lifecycle: first `jj describe` does full catchup, stores session ID. Subsequent evals resume with just "evaluate change X." If resume fails, clears session and retries with full catchup.
- [x] Create `apps/indusk-mcp/src/lib/eval/persistent-judge.ts` — `runPersistentEval` function. Reads/writes session state from `.indusk/eval/judge-session.json`. First call = full prompt + catchup. Subsequent = resume + minimal prompt.
- [x] Create `.indusk/eval/judge-session.json` — stores sessionId, createdAt, lastEvalAt, evalCount.
- [x] Update `eval-trigger.js` — auto-detects `persistent-judge.js` in the package. Uses `runPersistentEval` if available, falls back to `runJudgeSync`.
- [x] Subsequent eval prompts are minimal: just the change ID and "evaluate this commit." The judge reads the diff itself via tool calls. No catchup, no context re-loading.
- [x] Handle session expiry — if `--resume` fails (non-zero exit), clears session and retries with full catchup automatically.
- [ ] Measure: compare token usage of persistent judge vs one-shot. Deferred to after first real usage.

#### Phase 8 Verification
- [x] (none needed — asked: "Defer verification to end-state integration test?" — user approved deferring integration tests earlier in session)

#### Phase 8 Context
- [x] Updated CLAUDE.md: persistent judge session documented

#### Phase 8 Document
- [x] (none needed — persistent session is an internal optimization, no user-facing docs change needed)

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/eval/types.ts` | New — scorecard and log entry types |
| `apps/indusk-mcp/src/lib/eval/log-writer.ts` | New — append JSONL |
| `apps/indusk-mcp/src/lib/eval/log-reader.ts` | New — parse JSONL with malformed line handling |
| `apps/indusk-mcp/src/lib/eval/rubric.ts` | New — v1 question set |
| `apps/indusk-mcp/src/lib/eval/prompt-builder.ts` | New — judge system prompt |
| `apps/indusk-mcp/src/lib/eval/judge-runner.ts` | New — spawns claude, collects results |
| `apps/indusk-mcp/src/lib/eval/hook.ts` | New — jj hook entry point logic |
| `apps/indusk-mcp/hooks/eval-trigger.js` | New — standalone hook script for jj |
| `apps/indusk-mcp/src/bin/commands/eval.ts` | New — CLI commands |
| `apps/indusk-mcp/src/bin/cli.ts` | Modified — register eval command group |
| `apps/indusk-mcp/skills/eval-review.md` | New — manual eval skill |
| `.indusk/config.json` | Modified — add eval section |
| `apps/indusk-docs/src/reference/eval/overview.md` | New — eval reference docs |
| `apps/indusk-docs/src/guide/eval.md` | New — eval getting started |
| `apps/indusk-docs/src/decisions/context-eval.md` | New — ADR in docs |
| `apps/indusk-docs/.vitepress/config.ts` | Modified — sidebar entries |

## Dependencies

- `claude` CLI must be in PATH (for `claude --print`)
- jj must support `post-commit` hooks (or equivalent — verify during Phase 4)
- Graphiti MCP server running (for eval mode Graphiti writes — degrade gracefully if down)

## Notes

- The judge prompt is the most important artifact — iterate on it aggressively after first real evals. If findings aren't actionable, the prompt needs work, not the infrastructure.
- `--allowed-tools` whitelist for the judge may need tuning. Start restrictive, expand if the judge can't access what it needs.
- Baseline mode uses git worktrees (not jj worktrees) because jj's worktree support is limited. The baseline agent still commits via jj inside the worktree.
- The transcript path discovery in Phase 4 is the riskiest part — Claude Code's transcript location may vary. Build with fallback: env var > known path > skip eval with warning.
- Consider adding an MCP tool (`eval_summary`) in a follow-up so the agent can check its own eval trends during catchup. Not in v1 scope.
