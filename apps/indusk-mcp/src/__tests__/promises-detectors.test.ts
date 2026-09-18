import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { listOversizedChangedFiles } from "../lib/cleanup/oversized.js";
import { recordPhaseStart } from "../lib/shape/boundary.js";
import { changedFilesForPhase } from "../lib/shape/changed.js";
import { detectPhantomWork } from "../lib/verify/phantom.js";
import { git } from "./helpers/cli.js";
import { promiseProject } from "./helpers/promises-fixture.js";

/**
 * day-promises — A26: a file under `.indusk/promises/` is a plan document.
 *
 * Not code to Shape's changed-files scope, not machine state to phantom
 * detection (it counts as work), not a decomposition candidate to the cleanup
 * scan. The blanket `.indusk/` rules already give all three answers, so this
 * is a regression guard: the ADR's D9 registers the directory by name, and
 * this pins that the registration keeps the same answers.
 */

const IMPL = ".indusk/planning/seats-v2/impl.md";
const implWith = (box: string) =>
	`---\ntitle: x\nstatus: in-progress\n---\n\n## Checklist\n\n### Build Phase 1: Registry\n- [${box}] write the first promise\n\n#### Build Phase 1 Verification\n- [ ] run it\n`;

function write(root: string, rel: string, content: string): void {
	const path = join(root, rel);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content);
}

describe("A26 — .indusk/promises/ is a plan document to every what-changed detector", () => {
	it("Shape's changed-files scope excludes a promise file and keeps the code beside it", async () => {
		const p = promiseProject({ domains: ["seating"], activePlans: ["seats-v2"] });
		const sha = git(p.root, ["rev-parse", "HEAD"]).stdout.trim();
		await recordPhaseStart(p.root, {
			plan: "seats-v2",
			phase: 1,
			kind: "build",
			sha,
			at: new Date(Date.now() - 5_000).toISOString(),
		});
		write(
			p.root,
			".indusk/promises/seat-never-double-booked.md",
			"---\nname: seat-never-double-booked\n---\nA statement.\n",
		);
		write(p.root, "src/seats.ts", "export const seats = 1;\n");

		const changed = await changedFilesForPhase({ root: p.root, plan: "seats-v2", phase: 1 });
		expect(changed).toContain("src/seats.ts");
		expect(changed.some((f) => f.startsWith(".indusk/promises/"))).toBe(false);
	});

	it("phantom detection counts a promise file as real work beside a checked-off item", async () => {
		const p = promiseProject({ domains: ["seating"], activePlans: ["seats-v2"] });
		write(p.root, IMPL, implWith(" "));
		git(p.root, ["add", "-A"]);
		git(p.root, ["commit", "-q", "-m", "baseline"]);
		const baselineSha = git(p.root, ["rev-parse", "HEAD"]).stdout.trim();

		write(p.root, IMPL, implWith("x"));
		write(
			p.root,
			".indusk/promises/seat-never-double-booked.md",
			"---\nname: seat-never-double-booked\n---\nA statement.\n",
		);

		const findings = await detectPhantomWork({
			root: p.root,
			baselineSha,
			implRepoRelPath: IMPL,
			currentContent: implWith("x"),
			phase: 1,
		});
		expect(findings).toEqual([]);

		// The control: the same checkoff with nothing else changed IS phantom.
		const control = promiseProject({ domains: ["seating"], activePlans: ["seats-v2"] });
		write(control.root, IMPL, implWith(" "));
		git(control.root, ["add", "-A"]);
		git(control.root, ["commit", "-q", "-m", "baseline"]);
		const controlSha = git(control.root, ["rev-parse", "HEAD"]).stdout.trim();
		write(control.root, IMPL, implWith("x"));
		const controlFindings = await detectPhantomWork({
			root: control.root,
			baselineSha: controlSha,
			implRepoRelPath: IMPL,
			currentContent: implWith("x"),
			phase: 1,
		});
		expect(controlFindings.map((f) => f.kind)).toEqual(["phantom"]);
	});

	it("the cleanup scan never lists a promise file, however long", () => {
		const p = promiseProject({ domains: ["seating"], activePlans: ["seats-v2"] });
		const base = git(p.root, ["rev-parse", "HEAD"]).stdout.trim();
		const long = `---\nname: long\n---\n${"a line of history\n".repeat(600)}`;
		write(p.root, ".indusk/promises/long.md", long);
		write(p.root, "src/big.ts", `${"export const a = 1;\n".repeat(600)}`);
		git(p.root, ["add", "-A"]);
		git(p.root, ["commit", "-q", "-m", "long"]);

		const oversized = listOversizedChangedFiles(p.root, base).map((f) => f.path);
		expect(oversized).toContain("src/big.ts");
		expect(oversized.some((f) => f.startsWith(".indusk/promises/"))).toBe(false);
	});
});
