# A library your skills call is not shipped until it is exported AND its documented command has been run verbatim

`lifecycle-rebalance` built a library across six phases with 41 passing tests, and the feature had **never executed once**. Three independent breakages, none visible to any test:

1. `lib/shape/` was absent from `package.json` `exports`, so a consumer following the skill had no import path at all.
2. The skill's documented command invoked a bare `tsx` — not on `PATH` (it belongs to the package, so it needs `pnpm exec` from inside it) — with a top-level `await`, which `tsx -e` does not support. An agent following the instructions failed on the first one.
3. No boundary record existed, so the entry point had never been called outside a fixture.

**Why no test could see it:** all 41 imported the source directly. A test that imports `./thing.js` proves nothing about whether `@scope/pkg/thing` resolves, and **nothing in a typical repo executes a command that lives in a skill or a README** — so a broken instruction ships green forever.

**The rule, three parts:**
- Declare the export in the same commit as the first library file. Reachability is not a finishing step.
- **Paste the documented command and run it verbatim** before writing it down. Not a paraphrase, not "that should work" — the literal string, in the literal directory.
- Add a reachability test that derives its list from the *documentation* rather than hardcoding it beside the docs, or the assertion drifts from the claim it makes.

This is the sibling of `point-the-tool-at-itself-before-calling-it-done` and `consumer-reachability-before-publish`. Both lessons already existed in this repo and neither fired, which suggests the gap is structural: green tests feel like completion, and nothing in the loop asks "can anyone reach this?"
