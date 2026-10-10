/**
 * One run of the developer's `claude`, as the evaluator makes it: the prompt
 * on stdin, the answer on stdout. Shared by every evaluator runner.
 */

import { spawn } from "node:child_process";

export interface ClaudeRun {
	stdout: string;
	stderr: string;
	code: number | null;
}

export async function spawnClaude(args: string[], prompt: string, cwd: string): Promise<ClaudeRun> {
	return new Promise((resolve) => {
		const child = spawn("claude", args, {
			cwd,
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env },
		});

		let stdout = "";
		let stderr = "";
		let settled = false;
		const settle = (code: number | null) => {
			if (settled) return;
			settled = true;
			resolve({ stdout, stderr, code });
		};
		// A binary that cannot start (not installed, not executable) raises
		// `error` and never `close`; unheard, it kills the evaluator before it
		// can mark the run (day-monitor A25). It is a failed run like any other.
		child.on("error", (err) => {
			stderr += `claude could not be started: ${err.message}`;
			settle(-1);
		});
		child.stdin?.on("error", () => {
			// the child is gone; its exit or spawn error already says why
		});
		child.stdin?.write(prompt);
		child.stdin?.end();

		child.stdout?.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		child.on("close", (code) => settle(code));
	});
}
