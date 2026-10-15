# A test that compares a computed list with an expected list passes when both are empty — pair every comparison row with a case that plants the thing and must see it reported

**Rule:** a row that asserts "what the tool reports" equals "what is actually there" is not proven until some case makes the expected side non-empty. Write the companion case (plant one missing item in a fixture and require it to be reported) in the same phase as the comparison row.

**Why:** storybook-components row A2 compared the components `indusk looks coverage` reports as unimplemented with the components actually unimplemented in the admin. No code printed the first list (the CLI had no `unimplemented component:` line), and the admin had nothing missing, so both lists were empty and the row was green from the day it was written. Only the plan's cold audit noticed. Build Phase 11 added A40, a fixture mockup naming `ghost` that must read `unimplemented component: ghost`, which is the case that can fail.

**How to apply:**
- For any "reported equals actual" row, ask whether the actual side is non-empty in the test's data; if it is not, add the planted case in a fixture and assert the report names it.
- Assert the expected side is non-empty where it comes from live data (`expect(named.length).toBeGreaterThan(0)`), so an empty read cannot pass for the wrong reason.
- When the audit asks "does each row prove its promise's sentence or something narrower?", this is the first place to look.

See `.indusk/planning/archive/storybook-components/retrospective.md` ("What We Learned") and `audit.md`.
