import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AGENTS.md parity — the sibling of `skill-sync-parity.test.ts`.
 *
 * `apps/indusk-mcp/templates/AGENTS.md` is what every consumer project gets;
 * dusk's root `AGENTS.md` is what dusk's own agents read. dusk has no global
 * `indusk update`, so an edit to either side silently leaves the other stale —
 * a rule dusk follows that consumers never receive, or the reverse. Byte
 * equality pins the template as the single source: edit it, then copy.
 */

const REPO_ROOT = new URL("../../../..", import.meta.url).pathname;

describe("dusk's AGENTS.md is the shipped template, byte for byte", () => {
	it("root AGENTS.md matches apps/indusk-mcp/templates/AGENTS.md", () => {
		const template = readFileSync(join(REPO_ROOT, "apps/indusk-mcp/templates/AGENTS.md"), "utf-8");
		const root = readFileSync(join(REPO_ROOT, "AGENTS.md"), "utf-8");
		expect(root, "resync with: cp apps/indusk-mcp/templates/AGENTS.md AGENTS.md").toBe(template);
	});
});
