// clause: the-cost-sets-the-wait/holds-by-default
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readQuestionWaitSetting } from "./limits.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const home = (config?: unknown) => {
	const d = mkdtempSync(join(tmpdir(), "question-wait-"));
	dirs.push(d);
	if (config !== undefined) writeFileSync(join(d, "config.json"), JSON.stringify(config));
	return d;
};

describe("sessions.question_wait in the home config", () => {
	it("holds for every cost when the file or the key is absent", () => {
		const hold = { cheap: "hold", moderate: "hold", expensive: "hold" };
		expect(readQuestionWaitSetting(home())).toEqual(hold);
		expect(readQuestionWaitSetting(home({ sessions: { max: 2 } }))).toEqual(hold);
	});

	it("reads minutes and immediate, and refuses anything else naming the key", () => {
		expect(
			readQuestionWaitSetting(
				home({ sessions: { question_wait: { cheap: 5, moderate: "immediate" } } }),
			),
		).toEqual({ cheap: { minutes: 5 }, moderate: "immediate", expensive: "hold" });
		expect(() =>
			readQuestionWaitSetting(home({ sessions: { question_wait: { cheap: "soon" } } })),
		).toThrow(/sessions\.question_wait\.cheap/);
	});
});
