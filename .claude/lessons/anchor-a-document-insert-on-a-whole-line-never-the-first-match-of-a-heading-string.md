# Never insert into a markdown document at the first match of a heading string — anchor on the whole line or use the document's own heading parser

A heading's text can occur earlier inside prose, a table row or a code span; a replace at the first match splices into the wrong place and the validator may not run.

Why: appending Build Phase 8 to brief-as-the-contract's impl, the edit matched `## Files Affected` inside trajectory row A34's own Asserts text (it described a `## Files Affected` row) and inserted the whole phase inside that table row; the plan's phase and row became unreadable until the next commit repaired it (commits 97d99d38 and 41f48a4a).

How to apply: anchor on a line (`^## Files Affected$` with a multiline regex), or locate headings through `lib/impl-headings.ts`; after any scripted edit to an impl run the structure validator (`validate-impl-structure`) or `indusk plans status` before committing.
