import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * publish-hygiene A3: the release's publish step runs with npm's notices
 * off. `npm publish` logs one `notice` line per packed file — over a thousand
 * for 1.63.0, which pushed the run's failure off the screen. npm prints its
 * 2FA prompt with `output.standard`, which loglevel does not gate
 * (`lib/utils/open-url.js`), so `warn` hides the listing and keeps the
 * prompt, warnings and errors.
 */

const pkg = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8")) as {
	scripts: Record<string, string>;
};
const steps = pkg.scripts.release.split("&&").map((s) => s.trim());

describe("A3 — the release publishes without listing every file", () => {
	it("the publish step runs with npm_config_loglevel=warn", () => {
		const publish = steps.find((s) => s.includes("pnpm publish"));
		expect(
			publish,
			"lesson: the-release-prints-what-a-person-must-read-not-every-packed-file",
		).toMatch(/^npm_config_loglevel=warn pnpm publish\b/);
	});

	it("keeps every step it ran, in the same order", () => {
		expect(steps.map((s) => s.replace(/^npm_config_loglevel=warn /, ""))).toEqual([
			"bash scripts/release-guard.sh",
			// No slow tier here (release-checks-run-once, Sandy 2026-10-08): dusk's
			// releases are its own development loop, and the six-to-eight-minute
			// system tier blocking every landing and release cost more flow than a
			// patch release costs. It runs after release, in the background, as a
			// promise — the next item in known-issues.md.
			"npm whoami",
			"pnpm publish --no-git-checks",
			"node scripts/record-release.js",
		]);
	});
});
