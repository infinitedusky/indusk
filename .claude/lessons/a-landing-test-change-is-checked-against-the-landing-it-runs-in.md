# A landing-test change is checked against the landing it runs in — its wait bound must fit inside the test's own timeout and its load case must not saturate every core while other landings run

The a-run-can-be-trusted impl made the admin-recorder landing test patient, but the plan review found a wait bound longer than the test's own timeout (so the test would be killed before its own failure message) and a load case that saturates every core while other landings run (so it would cause the flakiness it fixes).

Rule: when a plan changes a test that landing runs, state its wait bound and its timeout side by side (bound < timeout), and size any simulated load below what the machine's other landings need. Related: measure-a-contract-tests-full-run-before-setting-its-timeout, a-timeout-measured-on-a-busy-loop-is-not-a-fact-about-the-port.

See .indusk/planning/a-run-can-be-trusted/plan-review.md; highlight h-20261019-032.
