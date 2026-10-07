import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { markProjectId } from "../lib/promises/config.js";
import { git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * promise: indusk-leaves-main-clean — bookkeeping-lives-where-it-is-read A6.
 *
 * A project made before this plan tracks its highlights queue and processed
 * list in git, under `.indusk/`. `indusk update` moves them into the
 * project's home outside every checkout, keeps every highlight and every
 * mark (so an unprocessed one stays unprocessed), takes them out of git and
 * ignores them.
 */

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = (prefix: string) => {
	const d = mkdtempSync(join(tmpdir(), prefix));
	dirs.push(d);
	return d;
};

const line = (o: object) => `${JSON.stringify(o)}\n`;

describe.skipIf(SHOULD_SKIP)(
	"A6 — update moves the tracked highlights into the project's home",
	() => {
		it("moves both files, keeps every record, and takes them out of git", () => {
			const home = tmp("bk-home-");
			const project = tmp("bk-project-");
			const env = { INDUSK_HOME: home, INDUSK_SKIP_SELF_UPDATE: "1" };
			git(project, ["init", "-q", "-b", "main"]);
			expect(runCli(project, ["init", "--force", "--no-index"], env).code).toBe(0);
			writeFileSync(
				join(project, ".indusk", "highlights.jsonl"),
				line({
					id: "h-1",
					timestamp: "2026-10-07T00:00:00Z",
					level: "note",
					tag: "t",
					note: "first",
				}) +
					line({
						id: "h-2",
						timestamp: "2026-10-07T00:01:00Z",
						level: "note",
						tag: "t",
						note: "second",
					}),
			);
			writeFileSync(
				join(project, ".indusk", "highlights-processed.jsonl"),
				line({ id: "h-1", processedAt: "2026-10-07T00:02:00Z", action: "skipped" }),
			);
			git(project, ["add", "-A"]);
			git(project, ["commit", "-qm", "before the move", "--no-verify"]);

			const update = runCli(project, ["update"], env);
			expect(update.code, update.stderr || update.stdout).toBe(0);

			const projectHome = join(home, "projects", markProjectId(project));
			const queue = join(projectHome, "highlights.jsonl");
			const processed = join(projectHome, "highlights-processed.jsonl");
			expect(existsSync(queue), `the queue is in ${projectHome}`).toBe(true);
			expect(readFileSync(queue, "utf-8")).toContain('"id":"h-2"');
			expect(readFileSync(queue, "utf-8")).toContain('"id":"h-1"');
			expect(readFileSync(processed, "utf-8")).toContain('"id":"h-1"');
			expect(readFileSync(processed, "utf-8"), "h-2 is still unprocessed").not.toContain(
				'"id":"h-2"',
			);

			const tracked = git(project, [
				"ls-files",
				".indusk/highlights.jsonl",
				".indusk/highlights-processed.jsonl",
			]);
			expect(tracked.stdout.trim(), "no longer tracked").toBe("");
			expect(git(project, ["check-ignore", "-q", ".indusk/highlights.jsonl"]).code, "ignored").toBe(
				0,
			);
		});
	},
);
