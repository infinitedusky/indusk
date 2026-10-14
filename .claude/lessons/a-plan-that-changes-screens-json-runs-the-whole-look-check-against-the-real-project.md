# A plan that changes screens.json must run the app's whole look check against the real project before it closes — a contract test over fixtures does not show the check still finishes

cockpit-redraw pointed the plan and brief screens in `screens.json` at `looks-fixture-*` plans that only A10's throwaway project holds. A10 (the contract test) passed against its fixtures, but `indusk looks check admin` against the person's own project got a 404 on the first fixture path, which `measure` threw and `openWithinTime` rethrew, so the whole run ended and lost every look it had measured. No trajectory row ran the whole-app check against the real project; the cold audit found it (audit.md, "What does the diff change that no row touches?"), and Build Phase 6 made a 404 an unchecked look.

Why: a look check opens pages; whether it can finish is a property of the project it runs against, not of the fixtures a test builds. A declaration that is only servable by a test project makes the daily and landing-time check unusable.

What to do: in the phase that changes `screens.json` (new screens, new paths, per-state paths), run the app's whole `indusk looks check <app>` against the real project and record the held / broken / unchecked counts in the phase. Prefer paths the real project serves; if a path can only be served by fixtures, say so and make sure the check names it unchecked and goes on. A 404 is a fact about the project, not a failed run; a 500 or refused connection still ends it.

See `.indusk/planning/cockpit-redraw/audit.md` and `retrospective.md`. Related: the lesson that a state the check cannot open is reported unchecked, never held.
