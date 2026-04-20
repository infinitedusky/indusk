# Ship fast and rewrite is cheaper than deliberate upfront — when the blast radius is low

# Ship fast and rewrite is cheaper than deliberate upfront — when the blast radius is low

When a plan's surface is small and wrong-decision cost is contained, shipping a working v1 quickly and letting real usage inform v2 beats deliberating architecture upfront.

## The pattern

`indusk-admin-ui` shipped as 1.26.0 with a per-project hosting model (each project spawns its own `next dev`). Within 24 hours, `admin-ui-hosting` (1.27.0) rewrote it as a machine-global daemon. Both plans were productive; neither was wasted:

- **v1 (1.26.0)**: produced the custom Tailwind primitives, the component-reuse audit discipline, the parser-reuse-via-subpath-exports pattern, the vitest-browser-playwright test harness, the structural malformed-frontmatter detection, the data-layer interface. All preserved and extended by v2.
- **v2 (1.27.0–1.27.7)**: rewrote the hosting model, the CLI lifecycle, the routing shape, and the bundling pipeline — the ~20% of v1's surface that didn't survive real use.

Total elapsed time from v1 ship to v2 ship: one day.

The **alternative**: deliberate the hosting model for a week, land a v1 that's "right" the first time. The cost of deliberation exceeds the cost of rewriting when the rewrite is this cheap. And the deliberation costs more than it looks: during that week, the project isn't learning anything about actual usage, so even the "right" upfront design is informed by nothing.

## When it applies

- The surface is small. Rewriting 60% of a 200-line module is cheap; rewriting 60% of a 20,000-line module is not.
- The wrong-decision blast radius is contained — no external API contracts, no schema migrations, no data loss vectors.
- The v1 ship happens fast (hours to days, not weeks). A slow v1 lose the speed advantage.
- You have the willingness to throw away code without sentiment. If v1 becomes emotionally load-bearing, the pattern breaks.

## When it doesn't apply

- External APIs or published schemas — v2 is a breaking change for every consumer.
- Database schemas / data formats — migrations are expensive regardless.
- Security boundaries — getting authN/authZ wrong in v1 can leak state that v2 can't recover.
- Plans whose v1 ship is expected to be long-lived — deliberate.

## The anti-pattern

"Ship fast and rewrite" becomes an excuse to skip thinking when it's invoked reflexively. The discipline is asking *before* v1 ships: "what's the wrong-decision blast radius? is rewriting cheaper than deliberating?" If you can't answer both questions, deliberate.

## Related

- `exception-docs-for-process-failures.md` — when v1 ships broken, document the failure mode immediately so v2 is informed. This lesson's mirror image.
- `verification-gates-need-adversarial-framing.md` — v1 gates can pass for the wrong reason (happy-path assumptions). v2's existence is sometimes the proof that v1 gates did pass for the wrong reason.

