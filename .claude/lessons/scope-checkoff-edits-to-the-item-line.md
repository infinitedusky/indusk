# When checking off an impl gate item, scope the Edit to the item line — never include the section header

When flipping an impl.md checklist item from `- [ ]` to `- [x]`, make the Edit's old_string match ONLY the item line (and maybe a neighbor line for uniqueness) — never start it at the `#### Phase N {Gate}` header. If the header is in old_string and you forget to reproduce it in new_string, you silently delete the section header, which structurally removes the gate section.

Concrete case (`workbench-setup-command`): I did this twice — checked off a Context item with an old_string that began at `#### Phase N Context` and a new_string that dropped it. The FIRST slip was caught by `validate-impl-structure.js` (its full-file re-validation triggers when the edit touches a `####`-matching region). The SECOND slid through undetected because that checkoff's new_string contained no `###`, so the hook's full-file validation never fired — the missing header would only have surfaced at phase close.

The habit: check boxes by matching the bullet text, not the heading. If you need a header in the old_string for uniqueness, reproduce it verbatim in new_string. And don't rely on the validator to catch a dropped header — its full-file check only fires when the edit itself contains a phase-header pattern.
