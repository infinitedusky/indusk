# A progress indicator's active/current label must never assert a fact it hasn't verified — say "unknown" or name the block, never fall through to the reassuring default

admin-ui-phase-progress's falsification pass found the same defect shape three separate times: a completed impl with a blocked row rendered "cleaned, awaiting /retrospective" (the happy-path label) instead of naming the block; a null readiness result rendered the same happy-path label instead of "unknown"; an all-checked in-progress impl rendered a blank active segment instead of a state that says why nothing is active.

Each case is a fallthrough: the deriving function had a default branch meant for the common case, and every uncommon case that didn't match an earlier condition silently landed there — a reassuring label for a state that was never actually observed to be true.

Rule: when a UI derives a status label from several possible readings of underlying state (readiness null vs missing vs blocked, a phase's boundary record present vs absent vs malformed), every branch must be enumerated and a fallthrough must render as "unknown" or name the specific gap — never the default happy-path string. Write this as a test per branch: "given readiness=null, the label is X" is a different assertion from "given readiness={missing:[...]}, the label is Y", and a shared fallthrough branch that satisfies both tests is the bug.

See `.indusk/planning/admin-ui-phase-progress/` (falsification phase) and the sibling lesson [[define-the-vocabulary-once-before-rendering-it]].
