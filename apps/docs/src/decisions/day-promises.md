# Promises — registry, check, self-hosting, page

**Status:** accepted (2026-09-18) · Day step 4a, "Promises — the contract's primitive"
**Full ADR:** `.indusk/planning/day-promises/adr.md` · **Guide:** [Promises](../guide/promises.md) · **Reference:** [`indusk promises`](../reference/cli/promises.md)

## What was decided

A project writes down what its system promises as one markdown file per promise under `.indusk/promises/`, and `indusk promises check` refuses the registry by name the moment it lies. The check is language-agnostic by construction: a code site or a test names a promise with the token `promise: <name>`, and the check verifies the declared paths carry it and that no token anywhere names something unregistered or retired. The admin lists every promise with its declared state and draws every `enforced` chip hollow, because nothing in this step observes anything.

| Question | Decision |
|---|---|
| Where does the registry live, in what shape? | A directory at the plan root: `.indusk/promises/<name>.md`, one per promise; `incidents/<id>.md`, one per incident. Frontmatter for the machine, the statement as the body's first paragraph, history below. A promise's history is its file's git log; two plans establishing promises touch different files. **Rejected:** one registry document (concurrent plans conflict; heading-prefix matching is a known bug class), the docs tree (a publication, absent from a workbench's plan root), JSON (human-authored, reviewed in diffs), sequential ids. |
| How does a promise link to code? | Declared `sites:` and `tests:` paths, each verified to carry the token; plus a reverse scan of the code root so an unregistered or retired name anywhere is refused. The check proves a test *names* a promise; that it *validates* it is Day step 6, binding. **Rejected:** grep-only discovery (a mention in prose satisfies it). |
| What must an `enforced` promise carry? | `behaviour` and `state`: a site and a test. `structure`: a test; sites optional ("exactly one of X" has no single site). `known-violated`: an open incident, no links. `declared`: no links while the owner is open; refused once the owner archives. `retired`: nothing, but citing it is refused. |
| Which states and lifetimes? | Four states — `declared`, `enforced`, `known-violated`, `retired` — `declared` its own state because "not built yet" and "cannot be upheld yet" mean different things. Two lifetimes — `holds`, `established` — an established promise must retire once its owner archives; retirement is by hand in this step. |
| Where are domains declared? | `promises.domains` in `.indusk/config.json`, ensured empty on `update`, never clobbered. A domain outside the list is refused naming the list. The registry has no head to hold them — it is a directory. |
| How many readers? | One library, `lib/promises/`, exported as the `promises/registry` subpath and read by the CLI, the `list_promises` MCP tool and the admin. The vocabulary is pinned single-definition, beside the lifecycle's, not inside it. |
| What does this repository self-host? | Three promises, one per kind: every shared rule has one definition (structure); the phase-boundary record is never malformed (state); every checkoff ran its gates (behaviour, hollow until Day step 5's gate ledger observes it). The registration rule — register when breakage would need a plan to reopen — was applied to eight candidates: five in, three out. |
| What does the admin show? | A project-wide Promises page beside Scorecards, grouped by owner plan, domain, state or kind; every `enforced` chip hollow; a malformed entry an error block naming file and field; no registry an empty state; "holding N" on an archived plan's segment, derived, no new lifecycle position. Chip maps `satisfies Record<PromiseState, …>` under the same parity test as the lifecycle's. |
| A workbench? | Registry from the plan root, sites and tests from the code root, through the one `resolveExecutionRoots`; zero or several declared repos refuse by name. `.indusk/promises/` is a plan document: not code to Shape and the cleanup scan, not machine state to phantom detection. |

## What this step does not do

The span mark and any observed health (Day 4b, `day-monitor`). Promises declared by the planner, trajectory rows that establish or preserve one, confirmation at close, the "touched, unacknowledged" verdict (Day 4c, `day-contract`). Automatic retirement of `established` promises at green.

## Consequences accepted

The check proves linkage, not binding. The form is proven on this repository's own three promises first; the first adoption elsewhere is where the twelve-defects-in-an-hour class shows up, and that is a later plan's. The token is a convention, not a type: a typo in a comment is a missing link the check reports as such.
