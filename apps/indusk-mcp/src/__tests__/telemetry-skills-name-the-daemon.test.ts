// clause: a-new-project-is-told-the-truth/the-skills-name-the-daemon
// promise: a-new-project-is-told-the-truth
//
// a-new-project-starts-instrumented, Test Phase 1: T17 - what InDusk installs to explain
// telemetry sends a person to the local daemon, never to a vendor or to the retired
// environment tool. Read: the otel, testing and local-telemetry skills, their installed
// copies in .claude/skills, the local-telemetry extension's README and the otel docs page.
// Each must say where the daemon is (`indusk telemetry address`) and name none of the
// vendors or tools below.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

const FILES = [
	"apps/indusk-mcp/extensions/otel/skill.md",
	"apps/indusk-mcp/extensions/testing/skill.md",
	"apps/indusk-mcp/extensions/local-telemetry/skill.md",
	".claude/skills/otel/SKILL.md",
	".claude/skills/testing/SKILL.md",
	".claude/skills/local-telemetry/SKILL.md",
	"apps/indusk-mcp/extensions/local-telemetry/README.md",
	"apps/docs/src/reference/tools/otel.md",
];

const RETIRED = [
	"dash0",
	"datadog",
	"newrelic",
	"honeycomb",
	"sentry",
	"composable.env",
	"ce env:build",
];
const ADDRESS_COMMAND = "indusk telemetry address";

function read(rel: string): string {
	const abs = join(REPO_ROOT, rel);
	expect(existsSync(abs), `${rel} exists`).toBe(true);
	return readFileSync(abs, "utf-8");
}

describe("telemetry-skills-name-the-daemon", () => {
	it("T17: the skills, their installed copies, the README and the otel page name no vendor or retired tool, and each names the daemon's address command", () => {
		const problems: string[] = [];
		for (const rel of FILES) {
			const text = read(rel);
			text.split("\n").forEach((line, i) => {
				for (const word of RETIRED) {
					if (line.toLowerCase().includes(word)) problems.push(`${rel}:${i + 1} names ${word}`);
				}
			});
			if (!text.includes(ADDRESS_COMMAND))
				problems.push(`${rel} never names \`${ADDRESS_COMMAND}\``);
		}
		expect(problems).toEqual([]);
	});
});
