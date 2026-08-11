# Run a new tool against its own repo before closing the plan — fixtures share the author's blind spots by construction

Unit tests written by the person who wrote the implementation inherit that person's model of the world, including the parts that are wrong. Fixtures are the most concentrated form of this: they encode the author's assumptions about shape, path, and environment, and then pass.

**The evidence.** A verification command shipped with 33 passing tests across 5 files, a 6-cell acceptance experiment against a real external agent, and a green suite. Pointing it at **its own plan** — the first time it ran against the real repository rather than a throwaway fixture — produced 16 false findings within seconds.

The cause was structural, not careless: every fixture built a temp repo where the project root and the package root are the *same directory*, so a package-relative path and a repo-root-relative path are indistinguishable. In a monorepo they are not. **No number of additional fixtures would have found this**, because they would all have been built the same way.

Running it for real also exposed two things no unit test touches: a runner CLI flag that is boolean (`--silent` in vitest 4), so an appended file argument gets swallowed as its value and every check fails for a parsing reason; and the fact that the plan's *own* data violated the convention the plan had just documented.

**The practice:** before a plan closes, run the thing it built against this repository, with real data, through the real entry point. Not the library function the tests call — the actual command, the way a user invokes it. Do it at the phase that ships the capability, not at plan close; two phases earlier here would have caught the path ambiguity before it was baked into the trajectory and before the acceptance experiment was designed around fixtures that hid it.

**Generalizes to:** linters run on their own source, formatters formatting their own repo, migration scripts run against the project's real history, doc generators pointed at the docs they document. Anywhere the tool and a plausible subject are both to hand, self-application is the cheapest test that does not share the author's blind spots.
