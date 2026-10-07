import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { registerPromiseTools } from "../tools/promise-tools.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { writePromise } from "./helpers/promises-fixture.js";
import { toolCaller } from "./helpers/tool-call.js";
import {
	git,
	makeVersionedWorkbench,
	type VersionedWorkbench,
} from "./helpers/versioned-workbench.js";

/**
 * promise: a-project-has-one-contract — workbench-plan-authoring A4, A5, A7, A8.
 *
 * A repo has one contract. In a workbench whose repo holds
 * `.indusk/promises/`, every reader takes the repo's; the workbench's own
 * folder is its shadow contract, read only while the repo holds none. Two
 * workbenches on one repo therefore read one set of promises.
 */

const DOMAIN = "seating";
const OWNER = "seat-holds";
const made: VersionedWorkbench[] = [];
afterEach(() => {
	for (const wb of made.splice(0)) wb.cleanup();
});

/** A workbench with a domain and an owning plan, so the registry check has nothing else to say. */
function prepared(wb: VersionedWorkbench, shadow: string[]): VersionedWorkbench {
	made.push(wb);
	const path = join(wb.root, ".indusk", "config.json");
	const config = JSON.parse(readFileSync(path, "utf-8"));
	config.promises = { domains: [DOMAIN] };
	writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
	mkdirSync(join(wb.root, ".indusk", "planning", OWNER), { recursive: true });
	writeFileSync(
		join(wb.root, ".indusk", "planning", OWNER, "brief.md"),
		"---\nstatus: draft\n---\n",
	);
	for (const name of shadow) writeFor(join(wb.root, ".indusk", "promises"), name);
	return wb;
}

function writeFor(dir: string, name: string): void {
	writePromise(dir, { name, kind: "structure", state: "declared", domain: DOMAIN, owner: OWNER });
}

/** The repo's own contract: its `.indusk/promises/`, committed in the repo. */
function giveRepoContract(repoDir: string, names: string[]): void {
	for (const name of names) writeFor(join(repoDir, ".indusk", "promises"), name);
	git(repoDir, ["add", "-A"]);
	git(repoDir, ["commit", "-qm", "the repo's contract"]);
}

async function listed(root: string): Promise<string[]> {
	const tools = toolCaller((server) => registerPromiseTools(server, root));
	const { json } = await tools.call("list_promises");
	const read = json as { ok: boolean; registry?: { promises: Array<{ name: string }> } };
	return (read.registry?.promises ?? []).map((p) => p.name).sort();
}

/** The count `indusk promises check` reports, from its summary line. */
function checked(root: string): number {
	const r = runCli(root, ["promises", "check"]);
	const m = `${r.stdout}\n${r.stderr}`.match(/(\d+) promises? —/);
	return m ? Number(m[1]) : -1;
}

describe.skipIf(SHOULD_SKIP)("one contract per repo", () => {
	it("A4 — a repo that holds a contract is read from the repo; the workbench's folder is not read", async () => {
		const wb = prepared(
			makeVersionedWorkbench({ repos: [{ name: "alpha" }], layout: "nested", shape: "workbench" }),
			["shadow-one", "shadow-two"],
		);
		giveRepoContract(wb.repos[0].dir, ["kept-by-the-repo"]);
		expect(await listed(wb.root)).toEqual(["kept-by-the-repo"]);
	});

	it("A5 — a repo with no contract is read from the workbench's shadow contract", async () => {
		const wb = prepared(
			makeVersionedWorkbench({ repos: [{ name: "alpha" }], layout: "nested", shape: "workbench" }),
			["shadow-one", "shadow-two"],
		);
		expect(await listed(wb.root)).toEqual(["shadow-one", "shadow-two"]);
	});

	it("A7 — the registry check and list_promises agree, with and without the repo's contract", async () => {
		const withRepo = prepared(
			makeVersionedWorkbench({ repos: [{ name: "alpha" }], layout: "sibling", shape: "workbench" }),
			["shadow-one", "shadow-two"],
		);
		giveRepoContract(withRepo.repos[0].dir, ["kept-by-the-repo"]);
		expect(checked(withRepo.root)).toBe((await listed(withRepo.root)).length);
		expect(checked(withRepo.root)).toBe(1);

		const shadowOnly = prepared(
			makeVersionedWorkbench({ repos: [{ name: "alpha" }], layout: "sibling", shape: "workbench" }),
			["shadow-one", "shadow-two"],
		);
		expect(checked(shadowOnly.root)).toBe((await listed(shadowOnly.root)).length);
		expect(checked(shadowOnly.root)).toBe(2);
	});

	it("A8 — two workbenches on one repo that holds a contract read the same promises", async () => {
		const first = prepared(
			makeVersionedWorkbench({ repos: [{ name: "alpha" }], layout: "sibling", shape: "workbench" }),
			["first-workbench-only"],
		);
		giveRepoContract(first.repos[0].dir, ["kept-by-the-repo"]);
		// A second workbench beside it, declaring the same repo where it already is.
		const second = prepared(
			makeVersionedWorkbench({
				repos: [{ name: "alpha" }],
				layout: "sibling",
				shape: "workbench",
				initRepos: false,
				extraConfig: {
					worktree: { shape: "workbench", repos: [{ name: "alpha" }], repos_root: first.reposRoot },
				},
			}),
			["second-workbench-only"],
		);
		expect(await listed(first.root)).toEqual(["kept-by-the-repo"]);
		expect(await listed(second.root)).toEqual(await listed(first.root));
	});
});
