# Eval Scorecard Format Fix — Lessons

Plan archive: `.indusk/planning/archive/eval-scorecard-format-fix/`. Shipped in indusk-mcp 1.24.0–1.24.4 over 5 publish cycles on 2026-04-19.

## What we learned

### `?? []` doesn't catch falsy-but-not-nullish values

`false ?? []` returns `false`, not `[]`. The nullish-coalescing operator only triggers for `null` and `undefined`. For "treat-as-array-if-array-shaped" semantics, use `Array.isArray(x) ? x : []`. The unguarded `for (const q of scorecard.questions ?? [])` would have been just-as-broken-but-less-loud if the model returned `questions: false` instead of omitting the field.

### Override model-supplied data when the wrapper has the truth

Claude doesn't know the current time, doesn't know spawn duration, doesn't know the actual MCP tool call count — but the wrapper does. Any field where the wrapper has authoritative data should be set BY the wrapper after `JSON.parse`, not trusted from the LLM output. Timestamps were the obvious case (Claude was rounding to 5-minute marks). Future hardening should audit the scorecard for other fields the wrapper could authoritatively set.

### Prompt instructions to LLMs are statistical, not deterministic

"Output ONLY JSON, no commentary" works most of the time but not always. Always pair the instruction with a tolerant parser. The instruction reduces fall-through frequency; the parser handles the residual cases. Don't choose one or the other.

### In-session falsification is structurally contaminated

The same agent who built the thing inherits all the assumptions and blind spots that produced the bug. "Same agent, goal-flipped" is cognitive theater unless something forces a fresh perspective. The cheat-sheet effect is real and unavoidable — the falsifier needs zero prior context to genuinely run the ritual blind. Plan #10 in master.md (`falsify-spawn-pattern`) refactors `/falsify` to spawn a fresh background agent for this reason.

### Test-plan dogfood on bugfix worked

This was the first plan to use the new test-plan document (1.22.0) on a bugfix workflow. The 7 behavioral assertions wrote themselves and made impl trajectory derivation mechanical — one row per assertion. Confirms test-plan isn't ceremony for small plans; it's a forcing function for "what would actually prove this works?"

## What we'd do differently

### Bundle related micro-changes into single bumps

1.24.1 (per-item commits) and 1.24.2 (describe-then-do anti-pattern) were two work-skill tightenings shipped 30 minutes apart. Could have been one bump if we'd noticed the second issue before publishing the first. Each `npm publish` + `npm i -g` cycle costs ~30s + manual approval — real operational drag at 5 cycles per plan.

### Audit wrapper-authoritative fields together, not one-at-a-time

The timestamp override (1.24.3) was a one-off response to a user observation. The same logic applies to `mcpToolCalls`, `actualGraphitiWrites`, `claudeUsageCost`, etc. Future plan should sweep these together rather than wait for users to notice each one.

### Run /falsify before declaring smoke complete, not after

We confirmed T7 (live smoke) passed, then ran /falsify which immediately found a Phase-3-bug. If /falsify had run BEFORE T7's success was declared, Phase 4 would have been part of the original plan rather than a "fix-in-scope" addition. The retrospective skill correctly hard-blocks without falsification, but the work skill could nudge "run /falsify before celebrating Phase N close."

### Lead with the cheat-sheet caveat when /falsify runs in-session

If the falsifier has prior context about a bug, they should flag the contamination immediately rather than presenting the hypothesis as if it came from independent investigation. The user surfacing the question forced the honest admission. Going forward: if /falsify runs in-session with prior context, lead with "I have prior context about X — finding it via /falsify is not a clean ritual run."
