import { execFile } from "node:child_process";

/**
 * Whose GitHub account a new project's repository would be made as
 * (new-project-flow, Build Phase 8). The account is read from `gh`, never
 * assumed: `gh repo create` uses whichever account `gh auth status` reports as
 * active, so the proposal's offer names that account, and with nobody signed
 * in it says so instead of failing at the last step. A repository is private
 * unless the person chose public; `Visibility` is the only two answers, and
 * `create.ts` passes the matching flag.
 *
 * promise: a-remote-repository-says-whose-and-who-can-see-it
 */

/** Who can see a repository: `private` is only its owner. */
export type Visibility = "private" | "public";

/**
 * Runs `gh` with these arguments and returns what it printed (both streams),
 * or null when `gh` is not installed. A non-zero exit still returns its text:
 * `gh auth status` exits 1 when any one saved account has a bad token. Tests
 * pass their own; they never run the real `gh`.
 */
export type GhRunner = (args: string[]) => Promise<string | null>;

/** The real `gh`. */
export const runGh: GhRunner = (args) =>
	new Promise((resolve) => {
		execFile("gh", args, { timeout: 10_000 }, (err, stdout, stderr) => {
			const missing = (err as NodeJS.ErrnoException | null)?.code === "ENOENT";
			resolve(missing ? null : `${stdout}\n${stderr}`);
		});
	});

const LOGGED_IN = /Logged in to \S+ account (\S+)/;
const ACTIVE = /Active account:\s*(true|false)/;

/**
 * The account `gh auth status` reports as active, or null when `gh` is missing
 * or nobody is signed in. A `gh` that predates "Active account" lines reports
 * its one account without one; that account is the active one.
 */
export async function githubAccount(run: GhRunner = runGh): Promise<string | null> {
	const out = await run(["auth", "status"]);
	if (out === null) return null;
	const accounts: { login: string; active: boolean | null }[] = [];
	for (const line of out.split("\n")) {
		const login = LOGGED_IN.exec(line)?.[1];
		if (login) accounts.push({ login, active: null });
		const active = ACTIVE.exec(line)?.[1];
		const last = accounts[accounts.length - 1];
		if (active && last) last.active = active === "true";
	}
	const marked = accounts.find((a) => a.active === true);
	if (marked) return marked.login;
	return accounts.every((a) => a.active === null) ? (accounts[0]?.login ?? null) : null;
}
