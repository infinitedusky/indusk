# A reader that skips folded text must fail open on an unclosed fold and the save check must refuse it — as for an unterminated fence

Skipping text inside a <details> fold without a rule for the missing </details> turned one forgotten closing tag into a cleanup phase that read finished while a task was unticked, a hole the falsification fix itself opened. Whenever a reader hides a delimited region, decide what happens when the delimiter never closes: the reader stops hiding at the next task or heading (fails open, like fencedLineMask) and the save check refuses it, naming the task.

Source: retro-lesson highlight h-20261015-015 (story-first-phases); foldedLineMask in lib/impl-parser-core.ts.
