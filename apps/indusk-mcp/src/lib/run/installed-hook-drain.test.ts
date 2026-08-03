import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hooksDir } from "./harness.test-support.js";

/**
 * A14 (dawn-hook-parity Phase 6, cleanup) — the drain must keep working when
 * invoked the way a CONSUMER invokes it: `node .claude/hooks/eval-trigger.js`
 * inside a project that has only the copied hooks directory, no package
 * `dist/`, no monorepo around it.
 *
 * Green from birth, deliberately: it is the tripwire for the Phase 6
 * extraction. Lifting the drain into a hook-local module (`_pending-drain.js`)
 * is only safe if that module travels with the hooks — this test fails the
 * moment an import resolves outside the copied directory.
 */

const execFileAsync = promisify(execFile);

interface ConsumerProject {
	root: string;
	shas: string[];
}

/** A project shaped like a consumer install: `.claude/hooks/` + `.indusk/`. */
async function makeConsumerProject(prefix: string, records: number): Promise<ConsumerProject> {
	const root = await mkdtemp(join(tmpdir(), `${prefix}-`));
	await mkdir(join(root, ".claude"), { recursive: true });
	// Exactly what init/update do: copy the hooks directory wholesale.
	await cp(hooksDir, join(root, ".claude", "hooks"), { recursive: true });
	await mkdir(join(root, ".indusk", "eval"), { recursive: true });
	await writeFile(
		join(root, ".indusk", "config.json"),
		JSON.stringify({ eval: { enabled: true } }),
	);

	const shas: string[] = [];
	const lines: string[] = [];
	for (let i = 0; i < records; i++) {
		const sha = `c0ffee${String(i).padStart(34, "0")}`;
		shas.push(sha);
		lines.push(
			JSON.stringify({
				sha,
				plan: "consumer-plan",
				phase: 1,
				source: "atdawn",
				timestamp: new Date().toISOString(),
			}),
		);
	}
	await writeFile(join(root, ".indusk", "eval", "pending.jsonl"), `${lines.join("\n")}\n`);
	return { root, shas };
}

describe("A14 — the drain works through the installed hook path", () => {
	let project: ConsumerProject;

	beforeEach(async () => {
		project = await makeConsumerProject("dawn-installed-drain", 2);
	});

	afterEach(async () => {
		await rm(project.root, { recursive: true, force: true });
	});

	it("drains from a copied .claude/hooks/ with no package around it", async () => {
		// A stub evaluator so the test never spawns a real session; the point
		// is that the HOOK loads and runs, not what the evaluator does.
		const stubPath = join(project.root, "stub-eval.mjs");
		await writeFile(
			stubPath,
			[
				'import { appendFileSync } from "node:fs";',
				'appendFileSync(".indusk/eval/results.log", JSON.stringify({ stub: true, argv: process.argv.slice(2) }) + "\\n");',
			].join("\n"),
		);

		const { stderr } = await execFileAsync(
			process.execPath,
			["--no-warnings", join(project.root, ".claude", "hooks", "eval-trigger.js"), "--drain-pending"],
			{
				cwd: project.root,
				env: { ...process.env, INDUSK_EVAL_CMD: `${process.execPath} ${stubPath}` },
			},
		);

		// The hook ran to completion from its installed location…
		expect(stderr).toContain("Drained 2 pending eval(s)");

		// …and actually evaluated both records.
		const results = (
			await readFile(join(project.root, ".indusk", "eval", "results.log"), "utf8")
		)
			.split("\n")
			.filter((l) => l.trim());
		expect(results).toHaveLength(2);

		// Both are ledgered, so a re-drain is a no-op.
		const second = await execFileAsync(
			process.execPath,
			["--no-warnings", join(project.root, ".claude", "hooks", "eval-trigger.js"), "--drain-pending"],
			{
				cwd: project.root,
				env: { ...process.env, INDUSK_EVAL_CMD: `${process.execPath} ${stubPath}` },
			},
		);
		expect(second.stderr).toContain("Drained 0 pending eval(s)");
	}, 30_000);
});
