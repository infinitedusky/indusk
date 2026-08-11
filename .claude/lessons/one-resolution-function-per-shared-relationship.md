# Two surfaces resolving the same relationship independently will disagree — share one resolution function

When two different rendering surfaces each need to derive the same relationship from the same underlying data (e.g. "which plans are this parent's children"), writing the resolution logic twice — even from the same intent — produces silent disagreement the moment either surface's edge cases diverge even slightly.

**The concrete case:** dawn-ui-plan-grouping's admin sidebar resolved a parent's subplan children from active plans only, while the plan detail page resolved the same relationship from active+archived plans with inverted precedence (archived winning over active, or vice versa — the two didn't match). The same plan rendered as a "queued placeholder" in the sidebar and as a real, populated card on the detail page, simultaneously, for the same data. Found via the falsification ritual, not initial review.

**Why it happens:** each surface's author reasons about "what should this look like" independently, and small precedence/filter choices (active-only vs active+archived, first-match vs last-match) look equivalent in isolation but produce different results at the edges (an archived child, in this case).

**The rule:** one resolution function per relationship, shared by every surface that renders it. If a sidebar and a detail page both need "this parent's resolved children," they must call the same function, not two independently-written equivalents — even when the surfaces render the result completely differently (a nested list vs a card grid). Divergence at the edges is not a risk to manage; it is close to guaranteed once there are two implementations to keep in sync.
