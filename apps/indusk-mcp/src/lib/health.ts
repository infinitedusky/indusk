/**
 * Where an extension's health checks should run.
 *
 * A check is a shell string in a manifest — `test -f instrumentation.py`,
 * `python -c "import opentelemetry"`. It cannot call a TypeScript path helper,
 * so a workbench-aware check would mean every extension author writing
 * workbench-aware shell. They will not, and it would be fragile if they did.
 *
 * So the runner supplies the cwd instead: each check runs once per declared
 * repo. The shell stays naive and becomes correct, and every manifest that has
 * already shipped is fixed without being edited.
 *
 * Found in a real workbench, where `otel-instrumentation-exists` ran at the
 * wrapper — which contains no code — and therefore **could never pass**, before
 * the work or after it.
 */

import { execSync } from "node:child_process";
import { join } from "node:path";
import { readWorkbenchRepos, repoDir, resolveReposRoot } from "./worktree/repos.js";

export interface HealthCheckSpec {
	name: string;
	command: string;
}

export interface HealthCheckResult {
	name: string;
	ok: boolean;
	/** The root that satisfied it, when one did. */
	satisfiedBy?: string;
	/** Every root attempted — so a failure can say how hard it looked. */
	triedRoots: string[];
	output?: string;
}

/**
 * The roots a check should be attempted in.
 *
 * A workbench returns its declared repos: that is where code lives, and the
 * wrapper holds only `.indusk/`. Anything else returns itself, which is the
 * behavior every non-workbench project already had.
 */
export function resolveCheckRoots(projectRoot: string): string[] {
	const repos = readWorkbenchRepos(projectRoot);
	if (repos.length === 0) return [projectRoot];

	// `repos_root` decides where repos live; `repoDir` decides each one's
	// directory name. Both already have single definitions — this is a caller.
	return repos.map((r) => join(resolveReposRoot(projectRoot), repoDir(r)));
}

/**
 * Run one check, in every root, and report where it passed.
 *
 * Passes if ANY root satisfies it. These checks ask "is this configured?" and in
 * a workbench the answer lives inside one of the repos; requiring every repo to
 * satisfy every check would make any polyglot workbench permanently red, which
 * is the failure mode that gets checks switched off.
 *
 * What this deliberately does NOT do is pass when nothing satisfies it anywhere.
 * A scope fix that turns a check green immediately is a relaxation in disguise.
 */
export function runHealthCheck(
	projectRoot: string,
	check: HealthCheckSpec,
	timeoutMs = 10_000,
): HealthCheckResult {
	const roots = resolveCheckRoots(projectRoot);
	let lastOutput: string | undefined;

	for (const cwd of roots) {
		try {
			const out = execSync(check.command, {
				cwd,
				timeout: timeoutMs,
				stdio: ["ignore", "pipe", "pipe"],
				encoding: "utf-8",
			});
			return { name: check.name, ok: true, satisfiedBy: cwd, triedRoots: roots, output: out };
		} catch (e) {
			lastOutput = e instanceof Error ? e.message : String(e);
		}
	}
	return { name: check.name, ok: false, triedRoots: roots, output: lastOutput };
}
