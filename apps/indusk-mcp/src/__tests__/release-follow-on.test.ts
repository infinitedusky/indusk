// clause: a-release-waits-for-a-known-wrong/release-refuses
import { afterEach, describe, expect, it } from "vitest";
import { SHOULD_SKIP } from "./helpers/cli.js";
import { type ReleaseProject, releaseProject } from "./helpers/release-fixture.js";

/**
 * decisions-as-questions T21 (system tier): `indusk release` run in a real
 * repository with an open follow-on plan refuses before any publish step,
 * naming the plan. Written red in Test Phase 1; the refusal is Build Phase 3.
 * `indusk release` has no dry-run, so the release command's own log
 * (`order.log`) is what proves nothing was published.
 */

let project: ReleaseProject;
afterEach(() => project?.cleanup());

describe.skipIf(SHOULD_SKIP)("T21 — a release waits for an open follow-on", () => {
	it("refuses naming the plan, and runs no publish step", () => {
		project = releaseProject();
		project.commit(
			".indusk/planning/seat-holds-q-1/brief.md",
			'---\ntitle: "Follow-on"\nstatus: draft\nfollow_on_of: seat-holds/q-1\n---\n\n# Follow-on\n',
			"an open follow-on",
		);
		const r = project.release();
		expect(r.code).not.toBe(0);
		expect(`${r.stdout}${r.stderr}`).toMatch(/seat-holds-q-1/);
		expect(project.orderLog()).not.toContain("release");
	});
});
