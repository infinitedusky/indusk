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
			// The slow tier runs before every publish (small-fixes A3): since dusk
			// installs its own build at landing, a publish is deliberate and rare, and
			// the wait belongs here, not at landing.
			// promise: dusk-installs-its-own-build
			"pnpm -w test:system",
			"npm whoami",
			// The server image, before npm (server-provisioning A18).
			// promise: the-recording-server-runs-from-a-published-image
			"bash scripts/release-image.sh",
			"pnpm publish --no-git-checks",
			"node scripts/record-release.js",
		]);
	});
});

/**
 * server-provisioning A18: every release publishes the recording server's
 * image, and a release whose image push fails is not a release. The image
 * step runs after `npm whoami` and before `pnpm publish`, joined by `&&`, so a
 * refused push stops the chain with nothing on npm.
 *
 * promise: the-recording-server-runs-from-a-published-image
 */
describe("A18 — the release publishes the server image before npm", () => {
	it("builds and pushes the image after the npm login check and before publishing", () => {
		const image = steps.indexOf("bash scripts/release-image.sh");
		const whoami = steps.indexOf("npm whoami");
		const publish = steps.findIndex((s) => s.includes("pnpm publish"));
		expect(image, "the release has no image step").toBeGreaterThan(-1);
		expect(image).toBeGreaterThan(whoami);
		expect(image).toBeLessThan(publish);
	});

	it("the image step pushes a tag named by the version, and fails the release when the push fails", () => {
		const script = readFileSync(
			join(__dirname, "..", "..", "scripts", "release-image.sh"),
			"utf-8",
		);
		expect(script).toMatch(/^set -euo pipefail$/m);
		expect(script).toContain('IMAGE="${INDUSK_IMAGE:-ghcr.io/infinitedusky/indusk-always-on}"');
		expect(script).toMatch(/VERSION="\$\(node -p 'require\("\.\/package\.json"\)\.version'\)"/);
		expect(script).toMatch(/docker push "\$\{IMAGE\}:\$\{VERSION\}"/);
	});
});
