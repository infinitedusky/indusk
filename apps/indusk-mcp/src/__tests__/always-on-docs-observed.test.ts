import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * day-always-on-deploy — A9: the docs say what was observed, not that nobody
 * has looked.
 *
 * `day-always-on` marked the image and the Fly reference as unrun, honestly,
 * because they were. Once the deploy has run them that marking is the
 * stale claim, and the guide's smoke procedure carries a dated record of what
 * each step showed.
 */

const GUIDE = join(REPO_ROOT, "apps/docs/src/guide/always-on.md");
const REFERENCE = join(REPO_ROOT, "apps/docs/src/reference/cli/telemetry-server.md");
const UNRUN = /\bunrun\b|nobody has run it/i;

describe("A9 — the always-on docs as observed", () => {
	it.each([GUIDE, REFERENCE])("%s no longer says the deployment is unrun", (file) => {
		const text = readFileSync(file, "utf-8");
		expect(text.match(UNRUN)?.[0] ?? null).toBeNull();
	});

	it("the guide's smoke procedure carries a dated record of what was observed", () => {
		const text = readFileSync(GUIDE, "utf-8");
		expect(text).toMatch(/^#{2,4} Observed\b.*\d{4}-\d{2}-\d{2}/m);
	});
});
