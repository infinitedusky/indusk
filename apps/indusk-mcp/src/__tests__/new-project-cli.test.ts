import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readPlanDeclarations } from "../lib/plan-parser.js";
import { git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * new-project-flow, Test Phase 1: A4, A6-A11, A13-A18, A21, A22 - what a person
 * gets from `indusk new-project`, the command the admin calls, run through the
 * built CLI on temporary directories.
 *
 * Nothing here touches the real machine: `INDUSK_HOME` is a temporary home, the
 * parent directory is a temporary directory, and `gh` is a script on `PATH`
 * that writes its arguments to a file and does nothing else - no network, no
 * daemon. A draft is seeded the way the admin seeds one (`start --message ...
 * --document <file>`) and its proposal is written the way the agent writes it
 * (`proposal.json` and `brief.md` in the draft's folder).
 *
 * Every test is red today because `new-project` is not a command; the first
 * assertion each one reaches is that the command ran.
 *
 * promise: a-new-project-is-made-by-the-agent
 * promise: a-new-project-has-the-standard-layout
 * promise: a-project-keeps-its-founding-brief
 * promise: a-new-version-of-the-founding-brief-shows-what-changed
 * promise: a-recommendation-can-be-declined
 * promise: the-core-is-always-kept
 * promise: a-new-project-publishes-nothing-unasked
 * promise: a-new-project-is-written-only-under-its-parent
 * promise: an-unkept-project-conversation-leaves-nothing-on-disk
 * promise: a-project-has-one-contract
 * promise: init-writes-no-vendor-into-an-app
 */

const NAME = "homework-gate";
const MILESTONES = ["lockdown-baseline", "school-hours-schedule", "parent-dashboard"];
const BRIEF = `# Homework Gate\n\nA parental control system: a child's devices stay locked until homework is done.\n`;

interface Sandbox {
	/** `INDUSK_HOME`: where drafts, the registry and the admin's settings live. */
	home: string;
	/** The directory a person configures as the parent of every new project. */
	parent: string;
	/** Where the CLI is run from: a directory that is not a project. */
	cwd: string;
	/** Documents the person adds, kept apart from everything the CLI writes. */
	docs: string;
	/** One line per `gh` call, its arguments. Absent when `gh` never ran. */
	ghLog: string;
	env: Record<string, string>;
}

const made: string[] = [];
afterEach(() => {
	for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function sandbox(): Sandbox {
	const root = realpathSync(mkdtempSync(join(tmpdir(), "new-project-cli-")));
	made.push(root);
	const dirs = {
		home: join(root, "home"),
		parent: join(root, "parent"),
		cwd: join(root, "cwd"),
		docs: join(root, "docs"),
		bin: join(root, "bin"),
	};
	for (const dir of Object.values(dirs)) mkdirSync(dir, { recursive: true });
	const ghLog = join(root, "gh.log");
	const gh = join(dirs.bin, "gh");
	writeFileSync(gh, `#!/bin/sh\nprintf '%s\\n' "$*" >> "${ghLog}"\nexit 0\n`);
	chmodSync(gh, 0o755);
	return {
		home: dirs.home,
		parent: dirs.parent,
		cwd: dirs.cwd,
		docs: dirs.docs,
		ghLog,
		env: {
			INDUSK_HOME: dirs.home,
			INDUSK_SKIP_TELEMETRY_AUTOSTART: "1",
			PATH: `${dirs.bin}:${process.env.PATH ?? ""}`,
			GIT_AUTHOR_NAME: "test",
			GIT_AUTHOR_EMAIL: "test@test.local",
			GIT_COMMITTER_NAME: "test",
			GIT_COMMITTER_EMAIL: "test@test.local",
		},
	};
}

const run = (sb: Sandbox, args: string[]) => runCli(sb.cwd, ["new-project", ...args], sb.env);

/** A document the person adds, written under its own name in a folder of its own. */
function document(sb: Sandbox, name: string, content: string | Buffer, version = "v1"): string {
	const dir = join(sb.docs, version);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, name), content);
	return join(dir, name);
}

function setParent(sb: Sandbox): void {
	const r = run(sb, ["parent", sb.parent]);
	expect(r.code, `new-project parent\n${r.stderr}`).toBe(0);
}

interface Proposal {
	name: string;
	location: string;
	repos: { name: string }[];
	milestones: string[];
	recommendations: { name: string; kept: boolean; reason?: string }[];
	documentsOff: string[];
	remote: { github: boolean };
}

const proposalFor = (sb: Sandbox, over: Partial<Proposal> = {}): Proposal => ({
	name: NAME,
	location: join(sb.parent, `${NAME}-workbench`),
	repos: [{ name: NAME }],
	milestones: MILESTONES,
	recommendations: [{ name: "docs-site", kept: true }],
	documentsOff: [],
	remote: { github: false },
	...over,
});

/**
 * A draft as the admin starts one, then the agent's two outputs written beside
 * it. Returns the draft's id and folder.
 */
function seed(
	sb: Sandbox,
	opts: { documents?: string[]; proposal?: Partial<Proposal> } = {},
): { id: string; dir: string } {
	const args = ["start", "--message", "A parental control system"];
	for (const file of opts.documents ?? []) args.push("--document", file);
	const started = run(sb, args);
	expect(started.code, `new-project start\n${started.stderr}`).toBe(0);
	const drafts = join(sb.home, "new-projects");
	const ids = existsSync(drafts) ? readdirSync(drafts) : [];
	expect(ids, "start left no draft folder under INDUSK_HOME/new-projects").toHaveLength(1);
	const id = ids[0] as string;
	const dir = join(drafts, id);
	writeFileSync(join(dir, "brief.md"), BRIEF);
	writeFileSync(join(dir, "proposal.json"), `${JSON.stringify(proposalFor(sb, opts.proposal))}\n`);
	return { id, dir };
}

/** Accepted: the project made, ready to be read. */
function accepted(
	sb: Sandbox,
	opts: { documents?: string[]; proposal?: Partial<Proposal> } = {},
): { root: string; repo: string } {
	setParent(sb);
	const { id } = seed(sb, opts);
	const result = run(sb, ["accept", id]);
	expect(result.code, `new-project accept\n${result.stdout}\n${result.stderr}`).toBe(0);
	const root = proposalFor(sb, opts.proposal).location;
	return { root, repo: join(root, opts.proposal?.repos?.[0]?.name ?? NAME) };
}

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf-8"));
const projectConfig = (root: string) => readJson(join(root, ".indusk", "config.json"));
const registered = (sb: Sandbox): string[] => {
	const path = join(sb.home, "projects.json");
	return existsSync(path) ? readJson(path).projects.map((p: { path: string }) => p.path) : [];
};

/** Every path under a directory, relative, sorted; nothing for a missing one. */
function tree(dir: string, base = dir): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true })
		.flatMap((e) => {
			const full = join(dir, e.name);
			const rel = full.slice(base.length + 1);
			return e.isDirectory() ? [rel, ...tree(full, base)] : [rel];
		})
		.sort();
}

describe.skipIf(SHOULD_SKIP)("indusk new-project", () => {
	it("A4 accepting makes the workbench, a repository with one commit, a worktrees folder, InDusk and a registered project", () => {
		const sb = sandbox();
		const { root, repo } = accepted(sb);

		expect(existsSync(join(root, ".indusk", "config.json"))).toBe(true);
		expect(existsSync(join(repo, ".git"))).toBe(true);
		expect(git(repo, ["rev-list", "--count", "HEAD"]).stdout.trim()).toBe("1");
		expect(existsSync(join(root, "worktrees"))).toBe(true);
		expect(registered(sb).map((p) => realpathSync(p))).toContain(root);
	});

	it("A6 a created project declares its repository with its worktrees folder, and lists nothing unattributed or unusual", () => {
		const sb = sandbox();
		const { root } = accepted(sb);

		expect(projectConfig(root).worktree.repos).toEqual([
			expect.objectContaining({ name: NAME, worktrees: "worktrees" }),
		]);
		const listed = runCli(root, ["worktree", "list"], sb.env);
		expect(listed.code, listed.stderr).toBe(0);
		expect(listed.stdout).toContain(`Repos (1): ${NAME}`);
		expect(listed.stdout).not.toMatch(/unattributed|unusual/i);
	});

	it("A7 a created project opens with the founding brief and a master plan ordering its milestones", () => {
		const sb = sandbox();
		const { root } = accepted(sb);

		const planning = join(root, ".indusk", "planning");
		const brief = readFileSync(join(planning, "project-brief.md"), "utf-8");
		expect(brief).toContain("kind: project-brief");
		expect(brief).toContain("A parental control system: a child's devices stay locked");
		expect(readPlanDeclarations(planning).roadmap).toEqual(MILESTONES);
	});

	it("A8 each document the person added is in the project byte for byte, beside the founding brief", () => {
		const sb = sandbox();
		const bytes = Buffer.from([
			0x23, 0x20, 0x73, 0x70, 0x65, 0x63, 0x0d, 0x0a, 0x00, 0xff, 0x20, 0x20, 0x0a,
		]);
		const text = "# Their own words\n\n  trailing spaces kept  \n\n\n";
		const { root } = accepted(sb, {
			documents: [document(sb, "spec.md", text), document(sb, "scan.bin", bytes)],
		});

		const planning = join(root, ".indusk", "planning");
		expect(readFileSync(join(planning, "sources", "spec.md"), "utf-8")).toBe(text);
		expect(readFileSync(join(planning, "sources", "scan.bin")).equals(bytes)).toBe(true);
		expect(existsSync(join(planning, "project-brief.md"))).toBe(true);
	});

	it("A9 adding a document under a name already added reports what changed and keeps the newer", () => {
		const sb = sandbox();
		const first = document(sb, "spec.md", "# Spec\n\nbudget: 5\nsame line\n", "v1");
		const { id, dir } = seed(sb, { documents: [first] });
		const newer = document(sb, "spec.md", "# Spec\n\nbudget: 8\nsame line\n", "v2");

		const added = run(sb, ["add", id, newer]);
		expect(added.code, `new-project add\n${added.stderr}`).toBe(0);
		expect(added.stdout).toMatch(/^-.*budget: 5$/m);
		expect(added.stdout).toMatch(/^\+.*budget: 8$/m);
		expect(readFileSync(join(dir, "documents", "spec.md"), "utf-8")).toContain("budget: 8");
		expect(readdirSync(join(dir, "documents"))).toEqual(["spec.md"]);
	});

	it("A10 declining a recommendation with a reason records it declined, with the reason", () => {
		const sb = sandbox();
		const reason = "We keep decisions in the brief, not in separate records";
		const { root } = accepted(sb, {
			proposal: {
				recommendations: [
					{ name: "docs-site", kept: true },
					{ name: "adr", kept: false, reason },
				],
			},
		});

		const recommendations = projectConfig(root).recommendations;
		expect(recommendations).toContainEqual({ name: "adr", kept: false, reason });
		expect(recommendations).toContainEqual({ name: "docs-site", kept: true });
	});

	it("A11 a proposal turning off the brief or the test plan is refused, naming the document", () => {
		for (const off of ["brief", "test-plan"]) {
			const sb = sandbox();
			setParent(sb);
			const { id } = seed(sb, { proposal: { documentsOff: ["adr", off] } });

			const refused = run(sb, ["accept", id]);
			expect(refused.code, `${off}: accept was not refused`).not.toBe(0);
			expect(refused.stderr, `${off}: refusal does not name it`).toContain(off);
			expect(existsSync(proposalFor(sb).location), `${off}: something was created`).toBe(false);
		}
	});

	it("A31 a location reached through a symbolic link that leads out of the parent is refused and nothing is made outside it", () => {
		const sb = sandbox();
		setParent(sb);
		const outside = join(dirname(sb.parent), "elsewhere");
		mkdirSync(outside, { recursive: true });
		symlinkSync(outside, join(sb.parent, "link"));
		const { id } = seed(sb, { proposal: { location: join(sb.parent, "link", "escaped") } });

		const refused = run(sb, ["accept", id]);
		expect(refused.code, "accept was not refused").not.toBe(0);
		expect(refused.stderr).toContain("outside the parent");
		expect(readdirSync(outside), "something was made outside the parent").toEqual([]);
	});

	it("A32 a location inside an existing git repository under the parent is refused and that repository is untouched", () => {
		const sb = sandbox();
		setParent(sb);
		const existing = join(sb.parent, "existing");
		mkdirSync(existing, { recursive: true });
		git(existing, ["init", "-q", "-b", "main"]);
		const before = tree(existing);
		const { id } = seed(sb, { proposal: { location: join(existing, "inner", "project") } });

		const refused = run(sb, ["accept", id]);
		expect(refused.code, "accept was not refused").not.toBe(0);
		expect(refused.stderr).toContain("existing");
		expect(refused.stderr).toContain("repository");
		expect(tree(existing), "the repository was changed").toEqual(before);
	});

	it("A13 creating without confirming the remote runs no GitHub command and leaves no remote", () => {
		const sb = sandbox();
		const { repo } = accepted(sb, { proposal: { remote: { github: false } } });

		expect(existsSync(sb.ghLog)).toBe(false);
		expect(git(repo, ["remote"]).stdout.trim()).toBe("");
	});

	it("A14 creating with the remote confirmed creates one private repository, once, and pushes the first commit", () => {
		const sb = sandbox();
		const { repo } = accepted(sb, { proposal: { remote: { github: true } } });

		const calls = existsSync(sb.ghLog)
			? readFileSync(sb.ghLog, "utf-8").split("\n").filter(Boolean)
			: [];
		expect(calls).toHaveLength(1);
		expect(calls[0]).toContain(`repo create ${NAME}`);
		expect(calls[0]).toContain("--private");
		expect(calls[0]).toContain(`--source ${repo}`);
		expect(calls[0]).toContain("--push");
	});

	it("A15 a proposal located outside the configured parent is refused and nothing is created", () => {
		const sb = sandbox();
		setParent(sb);
		const outside = join(sb.cwd, `${NAME}-workbench`);
		const { id } = seed(sb, { proposal: { location: outside } });

		const refused = run(sb, ["accept", id]);
		expect(refused.code).not.toBe(0);
		expect(refused.stderr).toContain(sb.parent);
		expect(existsSync(outside)).toBe(false);
		expect(tree(sb.parent)).toEqual([]);
		expect(registered(sb)).toEqual([]);
	});

	it("A16 with no parent configured, creation is refused, naming the command that sets one", () => {
		const sb = sandbox();
		const { id } = seed(sb);

		const refused = run(sb, ["accept", id]);
		expect(refused.code).not.toBe(0);
		expect(refused.stderr).toContain("indusk new-project parent");
		expect(tree(sb.parent)).toEqual([]);
		expect(registered(sb)).toEqual([]);
	});

	it("A17 discarding a conversation removes everything it held, and nothing is under the parent or in the registry", () => {
		const sb = sandbox();
		setParent(sb);
		const { id, dir } = seed(sb, { documents: [document(sb, "spec.md", "# Spec\n")] });
		expect(existsSync(dir)).toBe(true);

		const discarded = run(sb, ["discard", id]);
		expect(discarded.code, `new-project discard\n${discarded.stderr}`).toBe(0);
		expect(existsSync(dir)).toBe(false);
		expect(tree(join(sb.home, "new-projects"))).toEqual([]);
		expect(tree(sb.parent)).toEqual([]);
		expect(registered(sb)).toEqual([]);
	});

	it("A26 a reopened conversation with no agent running shows the same turns; discarding removes them", () => {
		const sb = sandbox();
		setParent(sb);
		const { id, dir } = seed(sb);
		// What the admin's session subscription appends while an agent talks.
		const lines = [
			{ type: "session", id: "s1" },
			{ type: "tool", name: "Read", input: { file_path: "planner.md" } },
			{ type: "text", text: "Three things are open." },
			{ type: "you", text: "A phone app." },
			{ type: "fold-opened", at: "2026-10-14T10:00:00.000Z" },
		];
		writeFileSync(
			join(dir, "transcript.jsonl"),
			`${lines.map((l) => JSON.stringify(l)).join("\n")}\n`,
		);

		const shown = run(sb, ["transcript", id]);
		expect(shown.code, `new-project transcript\n${shown.stderr}`).toBe(0);
		expect(
			shown.stdout
				.trim()
				.split("\n")
				.map((l) => JSON.parse(l)),
		).toEqual(lines);

		const discarded = run(sb, ["discard", id]);
		expect(discarded.code, `new-project discard\n${discarded.stderr}`).toBe(0);
		expect(existsSync(join(dir, "transcript.jsonl"))).toBe(false);
		expect(existsSync(dir)).toBe(false);
	});

	it("A18 a conversation left open has created nothing outside its draft folder", () => {
		const sb = sandbox();
		setParent(sb);
		const outside = () => ({
			parent: tree(sb.parent),
			cwd: tree(sb.cwd),
			home: tree(sb.home).filter((p) => p !== "new-projects" && !p.startsWith("new-projects/")),
			registry: registered(sb),
		});
		const before = outside();

		const { dir } = seed(sb, { documents: [document(sb, "spec.md", "# Spec\n")] });

		expect(existsSync(dir)).toBe(true);
		expect(outside()).toEqual(before);
		expect(existsSync(proposalFor(sb).location)).toBe(false);
	});

	it("A21 a created project resolves to exactly one contract", () => {
		const sb = sandbox();
		const { root, repo } = accepted(sb);

		const contractOf = (cwd: string) => {
			const r = runCli(cwd, ["promises", "check"], sb.env);
			return /(\S+\/\.indusk\/promises)\b/.exec(`${r.stdout}\n${r.stderr}`)?.[1];
		};
		const fromRoot = contractOf(root);
		expect(fromRoot, "promises check named no contract folder").toBeDefined();
		expect(contractOf(repo)).toBe(fromRoot);
		expect(existsSync(join(repo, ".indusk", "promises"))).toBe(false);
	});

	it("A22 the repository holds no telemetry vendor files written by installation", () => {
		const sb = sandbox();
		const { repo } = accepted(sb);

		const files = tree(repo).filter((p) => p !== ".git" && !p.startsWith(".git/"));
		expect(files.length, "the repository is empty").toBeGreaterThan(0);
		const written = files.filter((p) => /^(instrumentation|logger|filtering-exporter)\b/.test(p));
		expect(written, "installation wrote telemetry files into the repository").toEqual([]);
		const vendors = ["dash0", "datadog", "newrelic", "honeycomb", "sentry", "posthog"];
		for (const file of files) {
			const text = readFileSync(join(repo, file), "utf-8").toLowerCase();
			expect(
				vendors.filter((v) => text.includes(v)),
				`${file} names a vendor`,
			).toEqual([]);
		}
	});
});
