# `indusk run`

The external orchestrator: run a plan through a model-agnostic, gated agentic loop — InDusk's discipline lifted out of Claude Code so the same gates fire behind any model. Built by the [dawn-external-orchestrator](/decisions/) plan as Dawn's first buildable piece: the agentic loop is rented (Vercel AI SDK), the gate scripts are reused as-is, and only a thin adapter plus the loop control ported from `/work --autopilot` is owned.

```bash
indusk run <plan> --model claude|gpt|gemini|grok
```

`<plan>` resolves to an `impl.md`: an explicit path, a directory containing one, or a plan name under `.indusk/planning/`. The run is bound to the current project tree — tools cannot touch paths outside it.

## The loop

The loop control is the `/work --autopilot` contract, ported:

- **Per-phase scope.** One driver run per remaining phase, under a tight phase-only contract: work test-first, check off only this phase's items, never touch the Test Trajectory's `Asserts` / `Writable at` / `Passes at` columns or other phases. Already-complete phases (every item checked or carrying a bare `(none needed)` / `skip-reason:` opt-out) are skipped.
- **Advance-on-green.** A phase closes only when `check-gates` says so — the loop feeds it a would-be next-phase checkoff envelope (a synthetic probe phase on a temp copy of the impl) and requires exit 0. The model's self-report never advances the loop.
- **Goalpost guard.** The trajectory table is snapshotted pre-phase. An `Asserts` change, a `Passes at` moved later, or a removed row STOPS the loop loud with the violations surfaced — a gamed gate, not a passed one. State-cell transitions and added rows are legal. Detection, not reversion: the drift stays visible on disk.
- **Pause-at-human-gate.** Derived from the plan's own declarations — a `Deferred Verification` reference, `U`-prefixed deferred rows, manual/browser-smoke phrasing — with no new marker. The loop pauses *before* spending a model step and reports exactly what a human must check instead of self-approving judgment.
- **Red never auto-retries.** One honest driver attempt per phase; a phase that cannot reach green halts the run for a human decision.
- **Hard stop at impl-complete.** The loop runs impl phases only — it never runs `/falsify`, `/cleanup`, or `/retrospective`. Those are human-gated by design.

Exit codes: `0` impl-complete · `3` paused at a human gate · `1` stopped (red gate, moved goalposts, or bad invocation).

## Gate enforcement layers

The discipline lives in the shared gate scripts (`validate-impl-structure.js`, `check-gates.js`), resolved from the target project's `.claude/hooks/` (walking up from the tree root; missing hooks fail loud — run `indusk init`/`update` first). Three layers invoke them, none contains rule content:

1. **Own-the-execute (primary, model-invariant).** The edit/write tools' `execute` adapts each call to the scripts' `{ tool_name, tool_input, cwd }` stdin envelope and spawns them: exit `2` refuses the edit and returns the block message as the tool result; exit `0` applies. Lives below the provider swap, so it cannot vary per model.
2. **`toolApproval` (secondary, SDK-native).** The same gate chain runs as an AI SDK approval callback above the provider swap, with `experimental_toolApprovalSecret` HMAC-signing approvals — defense in depth and PreToolUse parity.
3. **The deliberate phase-close probe (loop-level).** `check-gates` invoked at each phase boundary, as described above.

Headless runs need `gate_policy: auto` in the impl frontmatter — there is no user in the loop to give conversation-proof skips to (`ask`, the default, would refuse bare opt-outs).

## `--model`

Selects the driver. Accepts a friendly alias — `claude`, `gpt`, `gemini`, `grok` — or a bare provider name (`anthropic`, `openai`, `google`, `xai`), resolved through the provider registry into a driver config (`provider`, key env var, default model). Defaults to `claude` (the first driver; the others land with the second-driver phase). Swapping models changes one provider factory line — gate behavior is structural, not per-model.

## Provider keys

Direct per-provider API keys, no commercial gateway — each provider is hit with your own key so per-provider credit arbitrage is preserved:

| Provider | Key env |
|----------|---------|
| `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `OPENAI_API_KEY` |
| `google` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| `xai` | `XAI_API_KEY` |

The command refuses to start when the selected driver's key env is unset. Note the Claude driver is metered API usage — a Claude Max/Pro subscription cannot authenticate SDK calls; keep Claude Code (native, flat-rate) for judgment-heavy work and route mechanical runs here by cost-to-durably-done.

## Reporting

Each closed phase reports steps, tool calls, and aggregated token usage (input/output) — the raw data for the cost-to-durably-done comparison the acceptance matrix runs across models and environments.
