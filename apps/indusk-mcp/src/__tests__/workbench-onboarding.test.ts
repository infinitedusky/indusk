import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { buildTwoRepoWorkbench, type TwoRepoFixture } from "./helpers/worktree-fixture.js";

/**
 * A1 — a second developer clones the workbench repo and has the context.
 *
 * The whole motivation for the plan, expressed as the smallest observable
 * fact: clone the context remote, and the first developer's planning history
 * and lessons are simply there. Today there is no context remote at all, so
 * this is red at the fixture's own premise until the workbench root becomes a
 * git repo.
 *
 * Paired with A10's restore: A1 is "the context arrived", A10 is "the repos
 * arrived". Both have to be true before a second developer can actually work,
 * and they fail independently — which is why they are separate rows.
 */

let fixture: TwoRepoFixture;

afterEach(() => {
	fixture?.cleanup();
});

describe.skipIf(SHOULD_SKIP)("A1 — the second developer sees the shared context", () => {
	/**
	 * Deliberately ONE test rather than two.
	 *
	 * An earlier split asserted "a fresh clone carries `.indusk/`" on its own,
	 * and it passed the moment it was written — because `gitInitWorkbench` is
	 * the fixture granting the very premise under test. It proved that `git
	 * clone` copies files. The claim worth pinning is the developer-visible
	 * one: after clone AND restore, they have context and every declared repo.
	 * That fails today at restore, which is where the real gap is.
	 */
	it("has context and every declared repo after clone + restore", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true });
		const second = join(fixture.root, "second-developer");
		fixture.cloneWorkbenchTo(second);

		// Clone alone is a shell — that is the state the plan opened with.
		for (const name of fixture.repoNames) {
			expect(existsSync(join(second, name))).toBe(false);
		}

		const { code } = runCli(second, ["workbench", "restore"]);
		expect(code).toBe(0);

		// Context travelled…
		const brief = join(second, ".indusk", "planning", "sample-plan", "brief.md");
		expect(existsSync(brief)).toBe(true);
		expect(readFileSync(brief, "utf-8")).toContain("Context worth sharing");

		// …and so did every repo the workbench is made of.
		for (const name of fixture.repoNames) {
			expect(existsSync(join(second, name, "README.md"))).toBe(true);
		}
	});
});
