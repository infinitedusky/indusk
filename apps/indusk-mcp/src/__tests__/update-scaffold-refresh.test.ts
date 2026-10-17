// clause: a-new-project-reports-from-its-first-run/a-newer-template-is-offered-not-forced
//
// a-new-project-starts-instrumented, Test Phase 1: T9 - `indusk update` never overwrites a
// scaffolded file a person has changed; the newer version is written beside it as
// `<file>.indusk-new` and update says so. A file nobody edited is left as InDusk wrote it
// with nothing beside it. Run through the built CLI on a Node project.
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

const made: string[] = [];
afterEach(() => {
	for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function nodeProject(): string {
	const parent = mkdtempSync(join(tmpdir(), "update-scaffold-refresh-"));
	made.push(parent);
	const dir = join(parent, "homework-gate");
	mkdirSync(join(dir, "src"), { recursive: true });
	git(dir, ["init", "-q"]);
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: "homework-gate", version: "0.0.0", dependencies: { express: "5.0.0" } }),
	);
	writeFileSync(join(dir, "src", "index.ts"), "export {};\n");
	return dir;
}

describe.skipIf(SHOULD_SKIP)("update-scaffold-refresh", () => {
	it("T9: an edited scaffolded file is left byte for byte with the newer version beside it; an unedited one is untouched", () => {
		const env = { INDUSK_SKIP_TELEMETRY_AUTOSTART: "1" };
		const dir = nodeProject();
		const init = runCli(dir, ["init"], env);
		expect(init.code, `init exit\n${init.stderr}`).toBe(0);

		const edited = join(dir, "src", "instrumentation.ts");
		const untouched = join(dir, "src", "logger.ts");
		expect(existsSync(edited), "init wrote src/instrumentation.ts").toBe(true);
		expect(existsSync(untouched), "init wrote src/logger.ts").toBe(true);

		appendFileSync(edited, "\n// the person's own line\n");
		const editedBytes = readFileSync(edited);
		const untouchedBytes = readFileSync(untouched);

		const u = runCli(dir, ["update"], env);
		expect(u.code, `update exit\n${u.stderr}`).toBe(0);

		expect(readFileSync(edited).equals(editedBytes), "the edited file is byte for byte").toBe(true);
		expect(existsSync(`${edited}.indusk-new`), "the newer version sits beside the edit").toBe(true);
		expect(u.stdout, "update says so").toContain("src/instrumentation.ts.indusk-new");

		expect(readFileSync(untouched).equals(untouchedBytes), "the unedited file is as written").toBe(
			true,
		);
		expect(existsSync(`${untouched}.indusk-new`), "nothing beside the unedited file").toBe(false);
	});
});
