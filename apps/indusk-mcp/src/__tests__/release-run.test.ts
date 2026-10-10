import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { git, SHOULD_SKIP } from "./helpers/cli.js";
import { type ReleaseProject, releaseProject } from "./helpers/release-fixture.js";

/**
 * release-records-its-failures, Test Phase 1 — A1–A5, A20, A21: `indusk release`
 * runs the release a project declares, in the order it declares.
 *
 * promise: a-release-runs-as-its-project-declares
 * promise: slow-checks-run-once-per-tree
 * promise: landing-and-release-name-the-projects-commands
 *
 * The release, slow and rerun commands are small shell scripts the fixture
 * commits (`helpers/release-fixture.ts`); they log their order to a file
 * outside the repository and exit as told. Every row reads what an outside
 * person could read: the exit code, the lines `indusk release` prints, the
 * order log and the release record in the project's home.
 *
 * The lines `indusk release` prints are the contract Build Phase 1 writes to,
 * one per line, at the start of the line:
 *
 *   release published | release not published
 *   release done | release not done
 *   the slow tests failed        (a red slow run; names no test)
 *   open failures: <what>        (a release that is published and not done)
 *   recorded: releases.jsonl     (the release record was appended)
 *   no release declared          (nothing was run)
 *   covered by the green run at  (inside a "slow tests skipped: ..." line)
 */

let project: ReleaseProject;
afterEach(() => project?.cleanup());

const head = (p: ReleaseProject) => git(p.root, ["rev-parse", "HEAD"]).stdout.trim();

describe.skipIf(SHOULD_SKIP)(
	"indusk release — the declared order and the declared meaning of done",
	() => {
		it("A1: slow tests `after` run second, and a red run still leaves the release done under done_when: published", () => {
			project = releaseProject({ slow: { when: "after", exit: 1 }, doneWhen: "published" });
			const r = project.release();
			expect(project.orderLog(), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toEqual([
				"release",
				"slow",
			]);
			expect(r.stdout).toMatch(/^release published$/m);
			expect(r.stdout).toMatch(/^release done$/m);
			expect(r.stdout).toMatch(/^the slow tests failed$/m);
			expect(r.stdout).toMatch(/^recorded: releases\.jsonl$/m);
			expect(r.code).toBe(0);
			expect(project.records()).toEqual([
				expect.objectContaining({
					version: "1.4.0",
					commit: head(project),
					published: true,
					done: true,
					slow: "red",
				}),
			]);
		});

		it("A2: slow tests `before` that go red stop the release before its command, and the failure is still recorded", () => {
			project = releaseProject({ slow: { when: "before", exit: 1 } });
			const r = project.release();
			expect(project.orderLog(), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toEqual(["slow"]);
			expect(r.stdout).toMatch(/^release not published$/m);
			expect(r.stdout).toMatch(/^the slow tests failed$/m);
			expect(r.stdout).toMatch(/^recorded: releases\.jsonl$/m);
			expect(r.code).not.toBe(0);
			expect(project.records()).toEqual([
				expect.objectContaining({ published: false, done: false, slow: "red" }),
			]);
		});

		it("A3: done_when: green with slow tests `after` that go red reports published, not done, naming the open failures", () => {
			project = releaseProject({ slow: { when: "after", exit: 1 }, doneWhen: "green" });
			const r = project.release();
			expect(project.orderLog(), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toEqual([
				"release",
				"slow",
			]);
			expect(r.stdout).toMatch(/^release published$/m);
			expect(r.stdout).toMatch(/^release not done$/m);
			expect(r.stdout).not.toMatch(/^release done$/m);
			expect(r.stdout).toMatch(/^open failures: .+$/m);
			expect(r.code).not.toBe(0);
			expect(project.records()).toEqual([
				expect.objectContaining({ published: true, done: false, slow: "red" }),
			]);
		});

		it("A4: a release command that fails is not published and runs no slow tests after it", () => {
			project = releaseProject({ command: { exit: 1 }, slow: { when: "after", exit: 0 } });
			const r = project.release();
			expect(project.orderLog(), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toEqual(["release"]);
			expect(r.stdout).toMatch(/^release not published$/m);
			expect(r.stdout).toMatch(/^release not done$/m);
			expect(r.code).not.toBe(0);
			expect(project.records()).toEqual([
				expect.objectContaining({ published: false, done: false, slow: "not run" }),
			]);
		});

		it("A5: a project that declares no release command says so and runs nothing", () => {
			project = releaseProject({ command: false, slow: { when: "after", exit: 0 } });
			const r = project.release();
			expect(`${r.stdout}${r.stderr}`).toMatch(/no release declared/);
			expect(project.orderLog(), "something ran").toEqual([]);
			expect(r.code).not.toBe(0);
		});

		it("A20: a slow run a green run already covered is skipped, as `checks slow --unless-covered` skips it", () => {
			project = releaseProject({ slow: { when: "after", exit: 0 } });
			project.recordGreenRun();
			const r = project.release();
			expect(project.orderLog(), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toEqual(["release"]);
			expect(r.stdout).toMatch(/^slow tests skipped: .*covered by the green run at /m);
			expect(r.code).toBe(0);
			expect(project.records()).toEqual([
				expect.objectContaining({ published: true, done: true, slow: "skipped" }),
			]);
		});

		it("A21: a release command that is not npm, a shell command writing a file, is the command that runs", () => {
			project = releaseProject({ slow: false });
			const r = project.release();
			const artifact = join(project.dir, "artifact.txt");
			expect(existsSync(artifact), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toBe(true);
			expect(readFileSync(artifact, "utf-8").trim()).toBe("built");
			expect(r.stdout).toMatch(/^release published$/m);
			expect(r.stdout).toMatch(/^release done$/m);
			expect(r.code).toBe(0);
			expect(project.records()).toEqual([
				expect.objectContaining({ version: "1.4.0", published: true, done: true, slow: "not run" }),
			]);
		});
	},
);
