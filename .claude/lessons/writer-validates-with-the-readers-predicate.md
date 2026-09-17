# A writer that appends to a shared record must validate with the same predicate its readers apply — one bad append blinds every reader

The phase-boundary record (`.indusk/phase-boundary.jsonl`) is read by Shape, `verify`, the dogfood test and the admin's plan page, and every reader correctly throws on a malformed line rather than skipping it (a skipped line silently widens a review scope). The writer, `recordPhaseStart`, appended whatever it was handed. One hand-written call with `phase: {kind, number}` where the signature takes `phase: <N>, kind` (and `tsx -e` does not type-check) produced one malformed line — and every reader refused the entire file at once: the admin showed an error block, the dogfood test went red, Shape could not scope.

The readers were right. The defect was the asymmetry: refusal lived only on the read side, so the file could be corrupted by the one code path that is supposed to guard it.

Rule: when a reader rejects a shape, the writer must reject the same shape before it lands, using the same predicate (one function, two callers — `boundaryRecordProblem` names the field for both). This applies to every append-only ledger: pending-eval, verify ledger, boundary record, any JSONL that several consumers parse. Test it as a row: "the writer given a record its reader would refuse throws naming the field and appends nothing; the read afterwards returns every record that was there."

Corollary: a documented CLI/skill snippet is safer than a hand-typed call for anything that writes shared state, because the snippet has been run and the hand-typed call has only been imagined.
