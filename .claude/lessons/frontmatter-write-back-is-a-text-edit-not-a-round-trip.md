# Write frontmatter back as a text edit — a gray-matter round trip rewrites lines it did not mean to touch

Checked before implementing the papers provenance write-back: `matter.stringify(content, data)` re-dumps every key through js-yaml. An unquoted `date: 2026-09-09` parses to a Date and comes back as `2026-09-09T00:00:00.000Z`; a quoted title loses its quotes. Every publish would have rewritten frontmatter lines that have nothing to do with the publish, and every diff would have carried that noise.

Why: a parse-then-dump round trip normalizes the whole document. It is correct for computing a hash (normalization is what you want there) and wrong for writing a file a human also edits.

How to apply: when a tool must add or replace specific frontmatter keys in a document people edit by hand, edit the fence's text (drop the lines for the keys you own, append your lines, leave every other byte). Quote values that could parse as another type — an all-digit short sha reads as a number. Keep the round trip for hashing and comparison only.
