import { spawn } from "node:child_process";

/**
 * The person's signed-in `fly` CLI, behind one seam (server-provisioning ADR
 * D2). The CLI's sign-in is the person's own; InDusk holds no Fly token.
 * Secrets go in on stdin, never as arguments, which the process list shows.
 */
export interface FlyResult {
	status: number;
	stdout: string;
	stderr: string;
}

export interface FlyCli {
	run(args: readonly string[], opts?: { stdin?: string }): Promise<FlyResult>;
}

/** Exit status a shell uses for "command not found"; the seam reports a missing CLI the same way. */
export const FLY_MISSING = 127;

export function realFly(bin = "fly"): FlyCli {
	return {
		run(args, opts) {
			return new Promise((resolve) => {
				const child = spawn(bin, [...args], { stdio: ["pipe", "pipe", "pipe"] });
				let stdout = "";
				let stderr = "";
				child.stdout.on("data", (d) => {
					stdout += d;
				});
				child.stderr.on("data", (d) => {
					stderr += d;
				});
				child.on("error", (err: NodeJS.ErrnoException) => {
					resolve({
						status: err.code === "ENOENT" ? FLY_MISSING : 1,
						stdout,
						stderr: stderr || err.message,
					});
				});
				child.on("close", (code) => resolve({ status: code ?? 1, stdout, stderr }));
				child.stdin.end(opts?.stdin ?? "");
			});
		},
	};
}
