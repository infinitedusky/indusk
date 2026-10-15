# A rule enforced at save time must be tested on both the Write and the Edit path — an early exit for edits with no phase structure silently exempted most real edits

In story-first-phases the phase-summary rule ran only on whole-file writes: validate-impl-structure.js exits early for an edit with no phase heading, unticked box or Tier line, so most real edits skipped the rule, and three phases of green tests used Write only. A cold audit found it. For any rule in a save-time hook, give each promise a row per entry point (Write, Edit, the gated loop) in Test Phase 1, and check the hook's early exits against the rule.

Source: retro-lesson highlight h-20261015-013 (story-first-phases); see hooks/CLAUDE.md on the fast path.
