# A find/replace patch across multiple call sites must assert its match count — a silently-skipped match produces a diff that looks locally correct but is globally broken

Root cause behind the workbench-verify-refusal.test.ts bug (commits 8c33a96a → ec827ad5): an earlier automated patch intended to remove `mkdirSync` usage from two call sites in the same file. It believed both were gone, but its first replacement silently failed to match its target — the first A17 test case kept its original body (still calling `mkdirSync`) while the patch script still stripped `mkdirSync` from the shared `node:fs` import at the top of the file, since the import-line edit was a separate, unconditional replacement that always matched. The result: a file that diffed cleanly, with no syntax error, but a `ReferenceError` at runtime in exactly one of the two edited call sites.

## Why

Each individual edit in a multi-target patch can look correct in isolation — the import line changed exactly as intended — while the patch as a whole is only correct if every intended call site was actually transformed. A patch script (or an agent editing several near-identical structures in one pass) that does not count/assert how many replacements it made cannot distinguish "found and fixed all N call sites" from "found and fixed N-1, and one target didn't match the pattern for some reason (whitespace, argument order, a variant a human would recognize as 'the same case' but the pattern didn't)."

## How to apply

When applying one logical change across multiple call sites — whether by hand, by scripted find/replace, or by an LLM edit pass — assert the match count before trusting the result: grep for the pattern's expected occurrence count before and after, or have the patch tool itself report "N replacements made" and compare against the expected N. A replacement that cannot find all its targets must refuse (raise, abort) rather than silently applying to whichever subset matched — the alternative is a diff that reviews as clean and a failure that only surfaces later, as a runtime error disconnected from the patch that caused it. This complements [[verify-the-adversarial-gate-you-wrote-not-just-its-presence]]: that lesson is about checking off gates on aggregate pass/fail counts; this one is about the upstream editing step that produced the false green in the first place.

