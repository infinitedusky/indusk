# Nesting derived from declarations needs one strict rule for cycles — a Path is inside another only if it does not also contain it

Source: cockpit-audit-fixes retrospective (highlight h-20261015-043). Two Paths declaring each other let the nav and the dashboard each break the tie their own way. Strict nesting gives one answer for every reader. How to apply: when a hierarchy is derived from declared links, define the cycle case once, in the shared derivation, and test a mutual declaration.
