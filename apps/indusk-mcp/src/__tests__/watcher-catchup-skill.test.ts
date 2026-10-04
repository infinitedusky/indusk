import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * watcher-heartbeat — A5: `/catchup` says *watcher blind* when
 * `promise_health` does, on its own line ahead of the roadmap, and reports no
 * promise counts with it.
 *
 * Catchup is where a session learns what is broken. A reader that can say
 * "watcher blind" is no use if the skill that reads it summarizes the answer
 * as "nothing needs attention". Both copies: the package's, which ships, and
 * the installed one, which this repository's sessions actually read.
 *
 * Red today: the skill names unreachable telemetry, never a blind watcher.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const COPIES = {
	package: resolve(HERE, "../../skills/catchup.md"),
	installed: resolve(HERE, "../../../../.claude/skills/catchup/SKILL.md"),
};

describe.each(Object.entries(COPIES))("A5 — the %s catchup skill", (_label, file) => {
	const text = () => readFileSync(file, "utf-8");

	it("says watcher blind on its own line, ahead of the roadmap", () => {
		expect(text()).toMatch(
			/watcher blind[\s\S]{0,300}(own line|line of its own)[\s\S]{0,200}(before|ahead of)[\s\S]{0,80}(roadmap|plan)/i,
		);
	});

	it("reports no promise counts while the watcher is blind", () => {
		expect(text()).toMatch(
			/watcher blind[\s\S]{0,500}(no|never)[^.]{0,60}(counts?|zero|violations)/i,
		);
	});
});
