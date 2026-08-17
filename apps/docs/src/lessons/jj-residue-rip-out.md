# The scope of an enforcement test is itself an untested artifact

When you remove something and write a test to keep it removed, you create two artifacts, not one: the removal, and a claim that the removal is complete. The test is the claim. Its **scope** — what it looks at and what shape of violation it can recognise — is never itself tested, and a scope that is narrower than reality produces a permanently green test over a permanently false claim.

This is the story of a guard that was green for seven weeks while the thing it guarded against was running on every page load, and then of its replacement, which had the same defect in a different dimension.

## Four axes, each failing silently

`git-only-substrate` (1.31.0) declared Jujutsu removed and backed it with a grep-style test: *scan these paths for these patterns, expect zero matches*. It passed continuously. Meanwhile `apps/indusk-admin/src/lib/vcs.ts` called `execFileSync("jj", …)` on every scorecard render.

Closing that gap surfaced four independent ways a "search and expect zero" test can be too narrow:

| Axis | The failure | How it hid |
|---|---|---|
| **Path scope** | Scanned `apps/indusk-mcp/src/` only | The violation lived in the other app |
| **Pattern scope** | Matched TypeScript identifiers (`getScm`, `NotAJjRepoError`) | The violation was a string literal in an argv array |
| **Match granularity** | Tested one line at a time | The call formats `execFileSync(` and `"jj",` on separate lines — a correct pattern still misses it |
| **File type** | `.ts`/`.tsx` only | Hooks are `.js`, extension manifests are `.json`, skills and guides are `.md` — all ship to consumers |

The first two were the original plan's. The third would have defeated the fix for the first two. **The fourth was introduced by the plan that fixed the first three** — corrected on two axes, reproduced the identical failure on a third, and shipped. Only the falsification ritual caught it.

What the fourth axis was hiding: the getting-started guide — the first page a new user reads — advertised a `/jj` slash command whose skill file had been deleted in 1.31.0.

## The rule

Before trusting a "search and expect zero" test, interrogate every axis separately:

1. **Paths** — every app and package where the thing could plausibly have lived, not just the one you were working in.
2. **Patterns** — every level the violation can appear at: symbol, string literal, subprocess argv, config value, prose instruction.
3. **Granularity** — whole-file, not line-at-a-time, unless you can prove no violation spans a line break.
4. **File types** — everything that ships or executes, including the non-source surfaces (hooks, manifests, skills, docs) that instruct agents and users.

Establish all four with a **scripted census**, not a reading. A manual survey reflects the files you remember touching.

## The countermeasure that actually worked

None of the above is reliable as a checklist, because the author is the person whose blind spots produced the scope. What worked was cheaper and mechanical:

> **Watch the test fail first, against a real violation, and say in the plan what the red output must name.**

The plan made the red observation the deliverable rather than a formality, and captured it verbatim as an artifact. An audit nobody has seen fail is indistinguishable from an audit that cannot fail — and the original had never been seen failing, which is precisely why it survived seven weeks of being wrong.

## The corollary: exemptions must be encoded, not decided

The counter-pressure to widening scope is false positives. An audit that fires on the decision record, the changelog, and the archived plans gets switched off within a week — the same end state as one that cannot fail.

So a widened audit needs an explicit preserved set. The trap found here: the changelog was **ruled** preserved history mid-plan and written up as such, but never added to the exemption list — because nothing scanned `.md` yet, so the omission was invisible. The moment scope widened, it would have flagged the changelog immediately.

**A decision recorded only in prose is not a decision the system holds.** Encode an exemption in the mechanism in the same change that decides it, even when the mechanism cannot currently reach the thing being exempted.

## Related

- [Git-only substrate](/decisions/git-only-substrate) — the decision this finishes
- [Falsification ritual](/guide/falsification-ritual) — what caught the fourth axis
- Full plan history: `.indusk/planning/archive/jj-residue-rip-out/`
