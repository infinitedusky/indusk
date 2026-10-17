// promise: a-recommendation-can-be-declined
//
// a-new-project-starts-instrumented, Test Phase 1: T20 - a project created through the
// new-project flow with telemetry declined records the decline with its reason, and now
// also turns the two telemetry extensions off: neither is enabled, no daemon is registered
// and no instrumentation is scaffolded. Driven the way new-project-cli.test.ts drives
// creation, through the built CLI on temporary directories: a temporary InDusk home, a
// temporary parent, and `gh` never reached.
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";

const NAME = "homework-gate";
const REASON = "We read our own logs; no telemetry for now";
const TELEMETRY_EXTENSIONS = ["local-telemetry", "otel"];

const made: string[] = [];
afterEach(() => {
	for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe.skipIf(SHOULD_SKIP)("new-project-telemetry-declined", () => {
	it("T20: a project created with telemetry declined records the reason, enables neither telemetry extension and gets no instrumentation", () => {
		const base = realpathSync(mkdtempSync(join(tmpdir(), "new-project-telemetry-declined-")));
		made.push(base);
		const home = join(base, "home");
		const parent = join(base, "parent");
		const cwd = join(base, "cwd");
		for (const d of [home, parent, cwd]) mkdirSync(d, { recursive: true });
		const env = {
			INDUSK_HOME: home,
			INDUSK_SKIP_TELEMETRY_AUTOSTART: "1",
			GIT_AUTHOR_NAME: "test",
			GIT_AUTHOR_EMAIL: "test@test.local",
			GIT_COMMITTER_NAME: "test",
			GIT_COMMITTER_EMAIL: "test@test.local",
		};
		const run = (args: string[]) => runCli(cwd, ["new-project", ...args], env);

		expect(run(["parent", parent]).code).toBe(0);
		const started = run(["start", "--message", "A parental control system"]);
		expect(started.code, `new-project start\n${started.stderr}`).toBe(0);
		const draft = join(home, "new-projects");
		const id = onlyDraft(draft);
		const root = join(parent, `${NAME}-workbench`);
		writeFileSync(join(draft, id, "brief.md"), "# Homework Gate\n\nA parental control system.\n");
		writeFileSync(
			join(draft, id, "proposal.json"),
			`${JSON.stringify({
				name: NAME,
				location: root,
				repos: [{ name: NAME }],
				milestones: ["lockdown-baseline"],
				recommendations: [{ name: "telemetry", kept: false, reason: REASON }],
				documentsOff: [],
				remote: { github: false },
			})}\n`,
		);
		const accepted = run(["accept", id]);
		expect(accepted.code, `new-project accept\n${accepted.stdout}\n${accepted.stderr}`).toBe(0);

		const config = JSON.parse(readFileSync(join(root, ".indusk", "config.json"), "utf-8"));
		expect(config.recommendations).toContainEqual({
			name: "telemetry",
			kept: false,
			reason: REASON,
		});
		expect(config.disabled_extensions ?? [], "both telemetry extensions are turned off").toEqual(
			expect.arrayContaining(TELEMETRY_EXTENSIONS),
		);
		for (const name of TELEMETRY_EXTENSIONS) {
			expect(
				existsSync(join(root, ".indusk", "extensions", name, "manifest.json")),
				`${name} is not enabled`,
			).toBe(false);
		}
		for (const dir of [root, join(root, NAME)]) {
			for (const file of ["instrumentation.ts", "src/instrumentation.ts", "instrumentation.py"]) {
				expect(existsSync(join(dir, file)), `${dir}/${file} was scaffolded`).toBe(false);
			}
		}
	});
});

/** The one draft folder `new-project start` left under `dir`. */
function onlyDraft(dir: string): string {
	const ids = existsSync(dir) ? readdirSync(dir) : [];
	expect(ids, "start left one draft folder").toHaveLength(1);
	return ids[0] as string;
}
