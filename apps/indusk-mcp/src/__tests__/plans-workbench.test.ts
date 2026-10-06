import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { briefText, implText } from "./helpers/plan-fixture.js";
import { writePromise } from "./helpers/promises-fixture.js";
import {
	commitFile,
	git,
	LAYOUTS,
	twoRepos,
	type VersionedWorkbench,
} from "./helpers/versioned-workbench.js";

/**
 * promise: a-plan-knows-its-code — workbench-plan-authoring A1, A2, A3.
 * promise: a-project-has-one-contract — workbench-plan-authoring A6.
 * promise: a-plan-is-written-on-its-own-branch — workbench-plan-authoring A11, A12.
 * promise: a-review-shows-its-evidence — workbench-plan-authoring A15.
 * promise: nothing-ships-until-accepted — workbench-plan-authoring A16.
 *
 * A plan in a workbench, through the CLI, in every layout a workbench can
 * declare: its documents at the workbench root, its code on `plan/<name>` in
 * the repo it names, the two linked by `.indusk/planning/<plan>/code.json`.
 */

const PLAN = "seat-holds";
const DOMAIN = "seating";
const NAME = "seat-released-on-timeout";
const SENTENCE = "A held seat is released when its hold runs out.";
const planDir = (wb: VersionedWorkbench) => join(wb.root, ".indusk", "planning", PLAN);
const out = (r: { stdout: string; stderr: string }) => `${r.stdout}\n${r.stderr}`;

const made: VersionedWorkbench[] = [];
afterEach(() => {
	for (const wb of made.splice(0)) wb.cleanup();
});

/** The fixture, with a promise domain declared so declare and check have one. */
function withDomain(wb: VersionedWorkbench): VersionedWorkbench {
	made.push(wb);
	const path = join(wb.root, ".indusk", "config.json");
	const config = JSON.parse(readFileSync(path, "utf-8"));
	config.promises = { domains: [DOMAIN] };
	writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
	git(wb.root, ["add", "-A"]);
	git(wb.root, ["commit", "-qm", "promise domain"]);
	return wb;
}

interface CodeFile {
	repo: string;
	branch: string;
	worktree: string;
}
const readCode = (wb: VersionedWorkbench): CodeFile =>
	JSON.parse(readFileSync(join(planDir(wb), "code.json"), "utf-8")) as CodeFile;
const codeRoot = (wb: VersionedWorkbench) => resolve(wb.root, readCode(wb).worktree);

describe.skipIf(SHOULD_SKIP).each(LAYOUTS)("a plan in a workbench — %s", (_label, build) => {
	it("A1 — start writes the documents at the root and the code worktree in the repo, on plan/<name>, and records both", () => {
		const wb = withDomain(build());
		const repo = wb.repos[0];
		const r = runCli(wb.root, ["plans", "start", "feature", PLAN]);
		expect(r.code, out(r)).toBe(0);

		expect(existsSync(join(planDir(wb), "brief.md"))).toBe(true);
		expect(git(wb.root, ["log", "--format=%s", "-1", "--", `.indusk/planning/${PLAN}`])).not.toBe(
			"",
		);
		expect(git(wb.root, ["branch", "--show-current"])).toBe("main");

		const code = readCode(wb);
		expect(code.repo).toBe(repo.name);
		expect(code.branch).toBe(`plan/${PLAN}`);
		expect(existsSync(codeRoot(wb))).toBe(true);
		expect(git(codeRoot(wb), ["branch", "--show-current"])).toBe(`plan/${PLAN}`);
		expect(git(repo.dir, ["branch", "--list", `plan/${PLAN}`])).toContain(`plan/${PLAN}`);
	});

	it("A11, A12, A15, A16 — approve merges nothing; the code stays on its branch; review lists the repo's files; land needs acceptance, then merges into the repo", () => {
		const wb = withDomain(build());
		const repo = wb.repos[0];
		expect(runCli(wb.root, ["plans", "start", "feature", PLAN]).code).toBe(0);
		const repoMainBefore = git(repo.dir, ["rev-parse", "main"]);

		writePromise(join(wb.root, ".indusk", "promises"), {
			name: NAME,
			kind: "state",
			state: "declared",
			domain: DOMAIN,
			owner: PLAN,
			statement: SENTENCE,
		});
		writeFileSync(
			join(planDir(wb), "brief.md"),
			briefText(PLAN, { makes: [{ name: NAME, sentence: SENTENCE }] }),
		);
		writeFileSync(
			join(planDir(wb), "impl.md"),
			implText(PLAN, { status: "draft", rows: [{ state: "planned" }] }),
		);

		// A11: approve checks the brief and marks it approved at the root; nothing merges.
		const approve = runCli(wb.root, ["plans", "approve", PLAN]);
		expect(approve.code, out(approve)).toBe(0);
		const impl = matter(git(wb.root, ["show", `HEAD:.indusk/planning/${PLAN}/impl.md`]));
		expect(impl.data.status).toBe("approved");
		expect(git(repo.dir, ["rev-parse", "main"])).toBe(repoMainBefore);

		// A12: the code is written on its branch; the repo's trunk does not move.
		commitFile(codeRoot(wb), "src/seat.ts", "export const seat = 1;\n", "the build");
		expect(git(repo.dir, ["rev-parse", "main"])).toBe(repoMainBefore);

		// A15: the review lists what the code branch changed, in the repo.
		const review = runCli(wb.root, ["plans", "review", PLAN, "--json"]);
		expect(review.code, out(review)).toBe(0);
		const files = (JSON.parse(review.stdout) as { files: Array<{ path: string }> }).files.map(
			(f) => f.path,
		);
		expect(files).toContain("src/seat.ts");

		// A16: not accepted, not landed; accepted, it merges into the repo and the code worktree goes.
		const early = runCli(wb.root, ["plans", "land", PLAN]);
		expect(early.code).not.toBe(0);
		expect(out(early)).toMatch(/accept/i);
		expect(git(repo.dir, ["rev-parse", "main"])).toBe(repoMainBefore);

		expect(runCli(wb.root, ["plans", "accept", PLAN]).code).toBe(0);
		const where = codeRoot(wb);
		const land = runCli(wb.root, ["plans", "land", PLAN]);
		expect(land.code, out(land)).toBe(0);
		expect(git(repo.dir, ["ls-tree", "-r", "--name-only", "main"])).toContain("src/seat.ts");
		expect(existsSync(where)).toBe(false);
		expect(git(repo.dir, ["branch", "--list", `plan/${PLAN}`])).toBe("");
	});

	it("A11 — a brief the check refuses is refused with the check's message, and nothing is marked approved", () => {
		const wb = withDomain(build());
		expect(runCli(wb.root, ["plans", "start", "feature", PLAN]).code).toBe(0);
		writeFileSync(
			join(planDir(wb), "brief.md"),
			briefText(PLAN, { makes: [{ name: NAME, sentence: SENTENCE }] }),
		);
		writeFileSync(
			join(planDir(wb), "impl.md"),
			implText(PLAN, { status: "draft", rows: [{ state: "planned" }] }),
		);
		const r = runCli(wb.root, ["plans", "approve", PLAN]);
		expect(r.code).not.toBe(0);
		expect(out(r)).toContain(NAME);
		expect(matter(readFileSync(join(planDir(wb), "impl.md"), "utf-8")).data.status).toBe("draft");
	});

	it("A3 — a code worktree that is gone is reported by the plan's record, never guessed", () => {
		const wb = withDomain(build());
		expect(runCli(wb.root, ["plans", "start", "feature", PLAN]).code).toBe(0);
		const where = codeRoot(wb);
		git(wb.repos[0].dir, ["worktree", "remove", "--force", where]);
		const r = runCli(wb.root, ["plans", "review", PLAN]);
		expect(r.code).not.toBe(0);
		expect(out(r)).toContain("code.json");
		expect(out(r)).toContain(readCode(wb).worktree);
	});
});

describe.skipIf(SHOULD_SKIP)("a plan in a workbench with two repos", () => {
	it("A2 — starting needs the repo named, and names the choices when it is not", () => {
		const wb = withDomain(twoRepos());
		const r = runCli(wb.root, ["plans", "start", "feature", PLAN]);
		expect(r.code).not.toBe(0);
		expect(out(r)).toContain("alpha");
		expect(out(r)).toContain("beta");
		expect(existsSync(planDir(wb))).toBe(false);
	});

	it("A2 — with --repo, the plan records it and its branch is in that repo only", () => {
		const wb = withDomain(twoRepos());
		const [alpha, beta] = wb.repos;
		const r = runCli(wb.root, ["plans", "start", "feature", PLAN, "--repo", "beta"]);
		expect(r.code, out(r)).toBe(0);
		expect(readCode(wb).repo).toBe("beta");
		expect(git(beta.dir, ["branch", "--list", `plan/${PLAN}`])).toContain(`plan/${PLAN}`);
		expect(git(alpha.dir, ["branch", "--list", `plan/${PLAN}`])).toBe("");
	});
});

describe.skipIf(SHOULD_SKIP)(
	"a promise declared by a workbench plan whose repo holds a contract",
	() => {
		it("A6 — is written in the plan's code worktree, so it lands with the code", () => {
			const wb = withDomain(LAYOUTS[1][1]());
			const repo = wb.repos[0];
			writePromise(join(repo.dir, ".indusk", "promises"), {
				name: "already-kept",
				kind: "structure",
				state: "declared",
				domain: DOMAIN,
				owner: "elsewhere",
			});
			git(repo.dir, ["add", "-A"]);
			git(repo.dir, ["commit", "-qm", "the repo's contract"]);
			expect(runCli(wb.root, ["plans", "start", "feature", PLAN]).code).toBe(0);

			const r = runCli(wb.root, [
				"promises",
				"declare",
				NAME,
				"--plan",
				PLAN,
				"--kind",
				"state",
				"--domain",
				DOMAIN,
				"--statement",
				SENTENCE,
			]);
			expect(r.code, out(r)).toBe(0);
			expect(existsSync(join(codeRoot(wb), ".indusk", "promises", `${NAME}.md`))).toBe(true);
			expect(existsSync(join(wb.root, ".indusk", "promises", `${NAME}.md`))).toBe(false);
		});
	},
);
