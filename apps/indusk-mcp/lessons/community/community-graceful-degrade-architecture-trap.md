# Graceful-degrade for substrate decisions is the architecture trap — pick deliberately

# Graceful-degrade for substrate decisions is the architecture trap — pick deliberately

When a plan touches a substrate decision (which database, which SCM, which auth model, which serialization format), "graceful degrade" is often picked as the safe-looking middle path. It is rarely the right long-term answer. It defers the harder commitment question and pays compounding cost during the deferral period.

## What goes wrong

`git-or-jj-substrate` (May 2026) picked graceful-degrade for the semantic graph: on git-mode projects, `indusk graph sync` no-ops with a clear "git mode — semantic graph unavailable" message. The plan justified this as "v1 ships dual-SCM; full git parity is future work."

The cost during the deferral period:
- 6 weeks of dual-SCM code paths to maintain
- `lib/scm/detect.ts`, `lib/semantic-graph/jj.ts`, branching logic at ~14 call sites
- Dual-form sections in 4 skills (`work.md`, `highlight.md`, `eval-review.md`, plus new `git.md`)
- The semantic graph was off on dusk's own codebase (which used git for some operations) — **so the system wasn't using its own substrate features**

Then `git-only-substrate` (June 2026, six weeks later) ripped all of it out. The dual-SCM model was determined to be wrong direction; git was the only substrate worth supporting; jj support was deleted entirely.

The `git-only-substrate` ADR explicitly named "keep graceful-degrade dual-SCM" as a rejected alternative with the reasoning: *"compounding debt, dusk's own file-linkage layer stays off."*

## Why graceful-degrade tempts

It looks like the safe choice. You don't break existing users; you ship something; you defer the hard question. Each individual decision feels reasonable: "we can polish git parity later."

But "later" never gets cheaper. The dual code paths compound. The downstream features (Dawn correlation, lessons capture, eval-trigger hooks) all have to know about both modes. The user-facing docs have to explain both. Every new feature now has a "what's the SCM behavior here?" question that wouldn't exist with a single substrate.

## The discipline

When a plan touches a substrate decision, force the commitment question at brief time:

> Is {substrate-A} something we're committed to long-term, yes or no? If no, drop it now.

If the answer is "no, we're not committed long-term" — pick the future-state substrate. Don't graceful-degrade.

If the answer is "yes, both are long-term" — design for both as first-class, not one-with-degraded-other.

If the answer is "we don't know yet" — that's the actual problem. Solve that before shipping any code.

## When graceful-degrade IS the right call

- When the "degraded" path is a one-way ratchet you commit to eventually replacing entirely (and you write down the replacement plan)
- When external users would be broken by a sharp pivot, AND those users matter enough to absorb the maintenance cost
- When the substrate decision genuinely needs production usage data to resolve

In all three cases: name the exit condition explicitly. "We're keeping graceful-degrade until {specific signal}, then we commit to {direction}." Without that, graceful-degrade is just deferral, and deferral pays compounding cost.

## Signal of trap

You catch yourself writing "v1 ships this as a known limitation" or "full parity is future work" in a brief. That's the smoke. Force the question: do we ever actually intend to do the future work? If not, pick now.

