# Landing a plan builds and links the checkout — it does not publish to npm

Sandy's decision 2026-10-08 (small-fixes plan, promise `dusk-installs-its-own-build`): after a plan lands, this machine's `indusk` becomes the landed build by installing straight from the checkout — no npm publish in the loop. Publishing is a separate, deliberate act that runs the full slow test tier first.

Why: the old per-plan publish-and-install cycle (release, install, propagation wait) was slower than the fast suite it should have cost, and tied every plan's landing to npm's publish latency and the slow tier. Decoupling "indusk is current" from "a release happened" lets landing stay cheap while publishing remains a deliberate, fully-tested act.

How to apply: don't assume a plan landing implies a version bump or npm publish — check `git rev-list <release-commit>..HEAD` for what's actually been packaged, never a version number alone (see also the existing `publish-baseline-is-the-release-commit` convention). See `.indusk/planning/small-fixes/brief.md` promise `dusk-installs-its-own-build` for the full promise text.
