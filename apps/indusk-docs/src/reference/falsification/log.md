# Falsification Log — Reference

Technical reference for the library primitives at `apps/indusk-mcp/src/lib/falsification/`. For the user-facing guide on running the `/falsify` ritual, see the [Falsification Ritual guide](/guide/falsification-ritual) (Phase 3 of `falsification-ritual` plan). For the design rationale, see [`.indusk/planning/falsification-ritual/adr.md`](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/falsification-ritual/adr.md).

## Log Format

The log lives at `.indusk/planning/{plan}/falsification.md` alongside the plan's research / brief / adr / impl / retrospective. It is **append-only markdown** — never edited in place. Each entry is an H2 section with a timestamp in the heading and structured bold-labeled fields in the body.

```markdown
# Falsification Log — {plan-name}

Append-only record of the /falsify bounty hunt for this plan. Never edit in place; entries are appended via `appendHypothesis` and `markTerminated`.

## Hypothesis 2026-04-17T10:58:45.123Z

**Hypothesis:** PokerV2Room calls `table.actionTaken()` directly, bypassing the new GameEngine interface the plan claims to validate.
**Test:** apps/game/src/__tests__/interface-bypass.test.ts
**Outcome:** fix-in-scope
**Note:** discovered while reviewing the Phase 4 harness path.

## Terminated 2026-04-17T11:42:13.456Z

**Reason:** investigated interface adoption, race conditions on handoff, and malformed-input paths; no further in-scope hypothesis could be formed.
```

## Types

```ts
type HypothesisOutcome = "fix-in-scope" | "spawn-plan" | "accept-finding";

interface HypothesisEntry {
  kind: "hypothesis";
  hypothesis: string;
  testPath: string | null;    // null when the hypothesis didn't yet have a test path
  outcome: HypothesisOutcome;
  note?: string;
  timestamp: string;          // ISO 8601
}

interface TerminatorEntry {
  kind: "terminator";
  reason: string;
  timestamp: string;          // ISO 8601
}

type LogEntry = HypothesisEntry | TerminatorEntry;
```

## `log.ts` API

### `appendHypothesis(planRoot, entry): HypothesisEntry`

Appends a confirmed-hypothesis entry to the plan's log. Creates the file with a header if it doesn't exist. Returns the stored entry (with generated timestamp) so the caller can confirm what landed on disk.

**Throws** when:
- the log is already terminated (a new hypothesis after a terminator is a sign the ritual was restarted incorrectly — see `isFalsificationComplete`)
- the `hypothesis` or `note` field contains a line-separator character (LF, CR, LS U+2028, PS U+2029). See [Content constraints](#content-constraints).

### `markTerminated(planRoot, reason): TerminatorEntry`

Appends a terminator entry marking the falsification ritual complete. No further hypotheses can be appended after this — `appendHypothesis` will throw. The `reason` is the user-confirmed rationale for termination (e.g., "investigated concurrency, race conditions, and partial-write paths; no in-scope failure remained").

**Throws** when:
- the log is already terminated
- `reason` is empty after trimming
- `reason` contains a line-separator character. See [Content constraints](#content-constraints).

### `readFalsificationLog(planRoot, opts?): LogEntry[]`

Parses the log into ordered entries. Returns `[]` if the log file does not exist (does not throw on missing file).

Malformed entries (missing required fields, invalid outcome value) are **skipped** — they do not appear in the returned array — and surfaced to the optional `opts.onMalformed` callback. This matches the [semantic-graph event log](/reference/semantic-graph/event-schema) resilience pattern: hand-edits and crashed writes produce lines the reader tolerates.

### `isFalsificationComplete(planRoot): boolean`

`true` iff the log exists AND its last entry is a terminator. `false` for a missing log, a log with only hypotheses (ritual started but not terminated), or an empty log file.

## `skip.ts` API

### `isFalsificationSkipped(implContent): { skipped: boolean; reason: string | null }`

Parses an impl.md's frontmatter and returns whether the author has explicitly opted out of the ritual. Opt-out requires **both** fields:

```yaml
falsification: skipped
falsification_reason: "a non-empty reason, quoted as a YAML string"
```

Returns `{ skipped: true, reason }` only when both are present and `reason` is non-empty after trimming. Any other state — missing `falsification`, flag set to anything other than `skipped`, missing or empty reason — returns `{ skipped: false, reason: null }`.

Robust to malformed YAML: never throws, returns `{ skipped: false, reason: null }` on parse failure.

### Why two fields instead of an inline pattern?

The ADR initially called for a single field like `falsification: skipped — reason: {text}`. In practice, YAML values containing both em-dashes and colons are fragile across parsers — the inner colon can be interpreted as a nested key. Two fields eliminate that class of bug and make the opt-out unambiguous to read. Same semantics, cleaner parse.

## Content constraints

The log's on-disk format is markdown sections with bold-labeled single-line fields (e.g., `**Hypothesis:** {value}`). The parser uses a line-oriented regex (`/^\*\*Hypothesis:\*\* (.+)$/m`). In JavaScript's `/m` mode, the `$` anchor matches before any line-separator character — not just `\n` but also `\r`, `\u2028` (LS), and `\u2029` (PS).

Consequently, **the `hypothesis`, `note`, and `reason` fields must be single-line.** The library rejects any line-separator character at the boundary:

- `appendHypothesis` throws if `hypothesis` or `note` contains LF, CR, LS, or PS
- `markTerminated` throws if `reason` contains any of the above

This is a deliberate contract rather than a silent normalization: multiline input either gets sanitized by the caller (collapse with `"; "`, split across multiple hypothesis entries, or use an external file and reference its path in `testPath`) or fails loudly. Round-trip fidelity is guaranteed for single-line content.

This rule was surfaced by the `/falsify` ritual running against the falsification-ritual plan itself — see [the plan's falsification log](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/archive/falsification-ritual/falsification.md) (path updates when plan archives) for the two confirmed hypotheses (LF truncation and CR/Unicode-line-separator truncation) that led to this constraint.

## Hook / Skill Integration

The retrospective skill's Step 0 (Falsification Gate) calls:

```ts
const ok = isFalsificationComplete(planRoot) || isFalsificationSkipped(implContent).skipped;
```

If `ok` is false, the skill refuses to proceed and surfaces the gate refusal message naming both satisfying conditions. This is the structural enforcement that makes the ritual load-bearing rather than advisory.
