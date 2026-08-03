# Dawn External Orchestrator — model-agnostic gated execution

**Decision (2026-07-26):** lift InDusk's discipline out of Claude Code by building a thin orchestrator (`indusk run <plan> --model X`, also installed as `atdawn`) that **rents** the agentic loop from the Vercel AI SDK, **reuses** the existing gate scripts unchanged, and **owns** only a ~50-line adapter plus the loop control ported from `/work --autopilot`.

Full ADR in the archive: `.indusk/planning/archive/dawn-external-orchestrator/adr.md`. Acceptance record: [the matrix lesson](/lessons/dawn-orchestrator-acceptance-matrix). CLI reference: [`indusk run`](/reference/cli/run).

## The load-bearing choices

1. **Vercel AI SDK as the rented loop** — the only TS-native framework first-class across anthropic/openai/google/xai with one-line provider swaps. Claude Agent SDK had the best hook model but is Claude-only — the exact coupling being removed.
2. **Gate enforcement below the provider swap** — the edit tool's `execute` spawns the gate program with the same stdin-JSON/exit-code contract the Claude Code hooks use. Gate behavior is structural, not per-model.
3. **Gate scripts reused as-is** — they were verified to be pure functions of *(edit intent + repo state) → allow/block* before any code was written; the port needed field-name mapping, nothing more.
4. **Direct per-provider keys, no commercial gateway** — preserves per-provider credit arbitrage; a registry maps `--model` aliases to providers and key env names.
5. **Billing lane split** — the orchestrator is the metered, cheap, mechanical lane; Claude Max flat-rate stays reserved for judgment-heavy work in Claude Code native. Parity and Max-subscription auth are mutually exclusive (subscription OAuth cannot fund SDK calls), so Claude runs through the orchestrator on API metering like every other model.

## Tradeoffs accepted

- **Thin harness**: no subagents, compaction, ask channel, or conventions injection — the orchestrator is the control group and the mechanical lane, not a Claude Code replacement.
- **`bash` confinement is best-effort, not a sandbox** — gate-relevant files are snapshot-gated and reverted, escapes are scanned for; falsification found (and closed) the fails-open hole this implies. See the gotcha in [`indusk run`](/reference/cli/run).
- **`gpt`/`grok` are registry entries without factories** until their drivers land; `gemini` and `claude` are proven live.

## What the acceptance data settled

Gate-hold was universal across 9 cells (3 models × 2 harnesses × 2 environments, failures included); mutation-based quality reads showed identical detection power across models and harnesses; routing verdict — flash for well-specified mechanical work, sonnet+ where unprompted discipline is load-bearing. A8 signed off 2026-08-03.
