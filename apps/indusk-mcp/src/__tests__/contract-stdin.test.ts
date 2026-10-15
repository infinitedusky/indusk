import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { CLI_BIN, type RunResult, runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { briefText, implText } from "./helpers/plan-fixture.js";
import { type PromiseProject, promiseProject } from "./helpers/promises-fixture.js";

// promise: a-large-impl-gets-the-same-contract-answer
// promise: the-everyday-suite-passes-on-main

/**
 * main-suite-green A1 — the contract check reads an impl of any size from stdin.
 *
 * The write hook pipes the impl to `indusk promises contract <plan> --impl-stdin`.
 * A synchronous read of fd 0 throws `EAGAIN` on a pipe whose writer has not
 * finished (the impl is over the 64 KB pipe buffer, so it never arrives at
 * once), so a large impl got a different answer from run to run. Through the
 * CLI, the way the hook reaches it: the boundary is the question.
 */

const PLAN = "seats-v2";
const MADE = "seat-released-on-timeout";
const SENTENCE = "A held seat is released when its hold runs out.";
const RUNS = 5;

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

/** An impl past 200 KB: a valid small one with a long note at its end. */
function largeImpl(): string {
	const small = implText(PLAN, {
		keys: ["test_purpose: required"],
		columns: ["For"],
		rows: [{ cells: { For: `promise: ${MADE}` } }],
	});
	const filler = "A line of notes that pads the impl well past the size of a pipe buffer.\n";
	return `${small}\n## Notes\n\n${filler.repeat(Math.ceil(200_000 / filler.length) + 1)}`;
}

/** The impl on stdin in two parts with a pause between, so the reader meets an empty pipe. */
function runWithStdin(cwd: string, impl: string): Promise<RunResult> {
	return new Promise((resolve, reject) => {
		const child = spawn("node", [CLI_BIN, "promises", "contract", PLAN, "--impl-stdin"], {
			cwd,
			env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1", INDUSK_HOME: cwd },
			stdio: ["pipe", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (c: Buffer) => {
			stdout += c.toString();
		});
		child.stderr.on("data", (c: Buffer) => {
			stderr += c.toString();
		});
		child.stdin.on("error", () => {});
		child.once("error", reject);
		child.once("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
		const half = Math.floor(impl.length / 2);
		child.stdin.write(impl.slice(0, half));
		setTimeout(() => child.stdin.end(impl.slice(half)), 100);
	});
}

describe.skipIf(SHOULD_SKIP)("A1 — a large impl on stdin gets one answer", () => {
	it("gives the answer the file gives, on each of five runs", async () => {
		const impl = largeImpl();
		expect(impl.length).toBeGreaterThan(200_000);
		fixture = promiseProject({
			domains: ["seating"],
			promises: [
				{
					name: MADE,
					kind: "state",
					state: "declared",
					domain: "seating",
					owner: PLAN,
					statement: SENTENCE,
				},
			],
			planFiles: {
				[`${PLAN}/brief.md`]: briefText(PLAN, { makes: [{ name: MADE, sentence: SENTENCE }] }),
				[`${PLAN}/impl.md`]: impl,
			},
		});
		const fromFile = runCli(fixture.root, ["promises", "contract", PLAN]);
		expect(fromFile.code, fromFile.stdout + fromFile.stderr).toBe(0);

		for (let run = 1; run <= RUNS; run++) {
			const fromStdin = await runWithStdin(fixture.root, impl);
			expect(fromStdin.code, `run ${run}: ${fromStdin.stderr}`).toBe(fromFile.code);
			expect(fromStdin.stdout, `run ${run}`).toBe(fromFile.stdout);
			expect(fromStdin.stderr, `run ${run}`).toBe(fromFile.stderr);
		}
	}, 60_000);
});
