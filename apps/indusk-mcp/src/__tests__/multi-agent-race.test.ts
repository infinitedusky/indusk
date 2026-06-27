import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseCurrentMd } from "../lib/agents/current-md.js";

/**
 * T15 — handoff-multi-agent-section-shape falsification.
 *
 * Two concurrent `indusk agent register` CLI processes with DISTINCT session IDs
 * against the same .indusk/current.md race on read-modify-write. The atomic
 * rename only prevents torn-write reads — it does not prevent two processes
 * from both reading the file, computing their respective mutations from the
 * shared starting state, and then each renaming over the other's write. The
 * last writer wins; the loser's section is gone.
 *
 * Fix: file lock around the read → mutate → atomic-rename sequence.
 *
 * Test strategy: run a workload of N concurrent register-pair iterations.
 * Without the lock, the race is probabilistic but reliably triggerable across
 * iterations. After the fix lands, both sections must be present in every
 * iteration.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = !existsSync(CLI_BIN);

interface Spawned {
	stdout: string;
	stderr: string;
	status: number | null;
}

function runCli(
	cwd: string,
	args: string[],
	env: NodeJS.ProcessEnv,
): Promise<Spawned> {
	return new Promise((resolveP) => {
		const child = spawn("node", [CLI_BIN, ...args], { cwd, env });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d) => {
			stdout += d.toString();
		});
		child.stderr.on("data", (d) => {
			stderr += d.toString();
		});
		child.on("close", (status) => {
			resolveP({ stdout, stderr, status });
		});
	});
}

function makeProject(): string {
	const dir = mkdtempSync(join(tmpdir(), "ma-race-"));
	mkdirSync(join(dir, ".indusk"), { recursive: true });
	writeFileSync(
		join(dir, ".indusk/config.json"),
		JSON.stringify({ mode: "normal", agents: { stale_ttl_minutes: 60 } }),
	);
	return dir;
}

describe.skipIf(SHOULD_SKIP)(
	"T15 — concurrent register race on current.md",
	{ timeout: 120000 },
	() => {
		let projectDir: string;

		beforeEach(() => {
			projectDir = makeProject();
		});

		afterEach(() => {
			rmSync(projectDir, { recursive: true, force: true });
		});

		// Run 20 iterations of "two concurrent registers" — without the file lock,
		// the race is reliably triggerable. With the lock, all 20 produce both
		// sections in the final current.md.
		it("T15: 20 iterations of two concurrent agent register calls — both sections present every time", async () => {
			const ITER = 20;
			let lostCount = 0;

			for (let i = 0; i < ITER; i++) {
				// Reset current.md each iteration
				const currentPath = join(projectDir, ".indusk/current.md");
				if (existsSync(currentPath)) rmSync(currentPath);

				const idA = `uuid-A-${i}-aaaaaaaa-aaaa-aaaa-aaaaaaaaaaaa`;
				const idB = `uuid-B-${i}-bbbbbbbb-bbbb-bbbb-bbbbbbbbbbbb`;

				const [resA, resB] = await Promise.all([
					runCli(projectDir, ["agent", "register", "--task", `A-${i}`], {
						...process.env,
						CLAUDE_CODE_SESSION_ID: idA,
					}),
					runCli(projectDir, ["agent", "register", "--task", `B-${i}`], {
						...process.env,
						CLAUDE_CODE_SESSION_ID: idB,
					}),
				]);

				expect(resA.status).toBe(0);
				expect(resB.status).toBe(0);

				const finalContent = readFileSync(currentPath, "utf-8");
				const parsed = parseCurrentMd(finalContent);
				const ids = parsed.sections.map((s) => s.sessionId).sort();
				const expected = [idA, idB].sort();

				if (
					ids.length !== 2 ||
					ids[0] !== expected[0] ||
					ids[1] !== expected[1]
				) {
					lostCount++;
				}
			}

			expect(lostCount).toBe(0);
		});

		// Sanity check that the test fixture is sound — single register works.
		it("T15 supporting: single register lands a section deterministically", async () => {
			const res = await runCli(
				projectDir,
				["agent", "register", "--task", "single"],
				{ ...process.env, CLAUDE_CODE_SESSION_ID: "uuid-single-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
			);
			expect(res.status).toBe(0);

			const content = readFileSync(join(projectDir, ".indusk/current.md"), "utf-8");
			const parsed = parseCurrentMd(content);
			expect(parsed.sections).toHaveLength(1);
		});
	},
);
