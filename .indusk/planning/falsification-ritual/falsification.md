# Falsification Log — falsification-ritual

Append-only record of the /falsify bounty hunt for this plan. Never edit in place; entries are appended via `appendHypothesis` and `markTerminated` from `apps/indusk-mcp/src/lib/falsification/log.ts`.

## Hypothesis 2026-04-17T15:42:22.935Z

**Hypothesis:** Log parser is line-oriented (regex with m flag + .+). Renderer writes user-supplied hypothesis/note/reason on a single line. Multiline content silently truncates at the first newline on round-trip.
**Test:** apps/indusk-mcp/src/lib/falsification/multiline.falsify.test.ts
**Outcome:** fix-in-scope
**Note:** Investigation surfaced by reading log.ts renderHypothesis / renderTerminator plus parseHypothesisBody / parseTerminatorBody. The regexes are /m single-line; .+ does not match newlines. Confirmed by 3 of 4 failing tests in multiline.falsify.test.ts — multiline hypothesis, multiline note, and multiline terminator reason all lose content after the first line. Fourth test (subsequent section parsing not corrupted) passed — the damage is scoped to the field content, not to section boundaries.

## Hypothesis 2026-04-17T15:46:22.360Z

**Hypothesis:** assertSingleLine only rejects LF. JavaScript regex / m mode treats CR as a line terminator too, so CR in content silently truncates the stored value on parse.
**Test:** apps/indusk-mcp/src/lib/falsification/multiline.falsify.test.ts
**Outcome:** fix-in-scope
**Note:** Confirmed via tsx eval: appendHypothesis with hypothesis set to a-CR-b stores only a. Same class of bug as the LF case; fix is to extend assertSingleLine to reject any line-separator character (LF, CR, and the Unicode LS U+2028 and PS U+2029 for completeness).

## Terminated 2026-04-17T15:47:41.430Z

**Reason:** Investigated 14 hypotheses across log parser (line-separator truncation, section-regex ambiguity, timestamp collisions, empty/malformed files, onMalformed callbacks), skip detection (empty strings, malformed YAML, wrong types, quoted values), retrospective gate (missing impl, valid/invalid skip shapes), and filesystem edges (ENOENT, EROFS, disk full). Two confirmed: LF truncation (Hypothesis 1) and CR/Unicode-line-separator truncation (Hypothesis 2) — both fixed in scope via assertSingleLine extended to reject LF, CR, LS (U+2028), and PS (U+2029). Remaining surfaces either out-of-scope (agent protocol compliance belongs to eval judge review, not library) or correctly handled (filesystem errors propagate cleanly to caller). No further in-scope hypothesis remained.

