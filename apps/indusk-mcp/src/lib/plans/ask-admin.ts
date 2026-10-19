import { realpathSync } from "node:fs";
import { daemonStatus } from "../admin/daemon.js";
import { readRegistry } from "../admin/registry.js";
import { resolvePlanCopies } from "../worktree/plan-worktrees.js";

/**
 * Ask the running admin to write a plan from its accepted brief
 * (a-brief-is-planned-unasked, ADR decision 5). The admin's host runs the
 * planning loop, as it runs builds, so `indusk plans accept-brief` can only
 * ask: the address is the one `indusk ui` recorded, and the project is the
 * registry's name for this checkout's project. Every way it cannot ask is said
 * plainly, never as success: the brief is accepted either way, and nothing will
 * write the plan until the admin is asked again.
 */

export interface AskAdminDeps {
	status: () => Promise<{ running: false } | { running: true; port: number }>;
	/** The registry name of the project `cwd` belongs to, or null when it is not registered. */
	projectName: (cwd: string) => Promise<string | null>;
	post: (url: string, body: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;
}

export const realAskAdminDeps: AskAdminDeps = {
	status: daemonStatus,
	projectName: async (cwd) => {
		const copies = await resolvePlanCopies(cwd);
		const root = canonical(copies.projectRoot);
		return readRegistry().projects.find((p) => canonical(p.path) === root)?.name ?? null;
	},
	post: (url, body) => {
		const origin = new URL(url).origin;
		return fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json", origin },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(20_000),
		});
	},
};

function canonical(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}

export async function askAdminToPlan(
	cwd: string,
	plan: string,
	deps: AskAdminDeps = realAskAdminDeps,
): Promise<string> {
	const status = await deps.status();
	if (!status.running) {
		return `The admin is not running, so nothing will write ${plan}'s plan yet: start it with \`indusk ui start\`; it plans a brief when one is accepted with it running, or when the last look the brief names is approved.`;
	}
	const project = await deps.projectName(cwd);
	if (!project) {
		return `This project is not registered with the admin, so nothing will write ${plan}'s plan: register it by running \`indusk ui\` here.`;
	}
	let res: Awaited<ReturnType<AskAdminDeps["post"]>>;
	try {
		res = await deps.post(`http://127.0.0.1:${status.port}/api/plans/plan`, { project, plan });
	} catch (err) {
		return `The admin did not answer on port ${status.port} (${(err as Error).message}), so nothing will write ${plan}'s plan yet.`;
	}
	const answer = (await res.json().catch(() => null)) as {
		started?: boolean;
		stop?: { step?: string; why?: string; looks?: string[] } | null;
		error?: string;
	} | null;
	if (res.status >= 400) {
		return `The admin refused to plan ${plan}: ${answer?.error ?? `status ${res.status}`}.`;
	}
	if (answer?.started) return `The admin is writing ${plan}'s plan; it stops for your approval.`;
	const stop = answer?.stop;
	if (stop?.step === "wait-for-looks") {
		return `The admin will write ${plan}'s plan when every look its brief names is approved${stop.looks?.length ? ` (waiting on: ${stop.looks.join("; ")})` : ""}.`;
	}
	return `The admin started no planning run for ${plan}: ${stop?.why ?? stop?.step ?? "no reason given"}.`;
}
