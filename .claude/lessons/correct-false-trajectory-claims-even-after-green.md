# A trajectory row that guards pre-existing behavior can never be authored RED — correct a false "authored RED" claim as soon as it's found, don't leave it standing because the row is green

Some trajectory rows exist to assert that *pre-existing* behavior a plan's new code never touches keeps working (a regression guard). If the row's test only imports pre-existing modules — never the plan's own new code — it was green the moment it was authored, because there was never a code path that could make it fail. Claiming it was "authored RED against today's behavior" in that case is false, even if every other row genuinely was red.

Seen in dusk: lifecycle-rebalance's A3 and A9 (`apps/indusk-mcp/src/lib/shape/gate-interaction.test.ts`) assert pre-existing `impl-parser.ts` / `cleanup/oversized.ts` behavior — the file imports only those two modules, never anything from `lib/shape/*`. Phase 1's verification note claimed "A3 and A9 authored RED against today's behavior." That was checked and found false in Phase 2 (commit a829acd9): both passed the instant they were written, because Shape's own code (whose absence was the only thing making sibling rows red) was never in their import graph.

The fix is not to reclassify the row as illegitimate — a regression guard on existing behavior is a legitimate trajectory row. The fix is:
1. Correct the false claim explicitly in the verification note (don't silently move on once the row is green — say what was wrong and why).
2. Mark the row's State honestly (`passing`, not `written`) once you've confirmed it never had a red phase.
3. Distinguish "this row has no red phase because its subject predates the plan" from "this row *should* have gone through red and didn't" (test-red-at-earliest-writable-phase covers the latter, write-time case) — they look identical in a green trajectory table, but only a self-audit that checks the test's actual import graph against what code it's supposed to guard can tell them apart.

The tell: grep the test file's imports. If none of them resolve to a module the current phase (or any earlier phase of this plan) wrote, the row was never capable of being red, and any claim that it was authored red is worth checking and correcting.
