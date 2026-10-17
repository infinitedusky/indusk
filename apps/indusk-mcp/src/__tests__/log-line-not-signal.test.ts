// clause: a-new-project-is-told-the-truth/a-log-line-is-not-a-signal
//
// a-new-project-starts-instrumented, Test Phase 1: T18 - nothing InDusk hands an app or
// installs for the agent presents a log line as a promise's signal; a signal is a span
// the helper writes. Read: the logger template and the otel, testing and local-telemetry
// skills. A log line may carry diagnosis; it may not be called the home of business events
// or measurements. Each skill says a signal is a span and names the helper's call, and the
// otel skill's log-correlation example uses the keys the log transport reads.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

const PACKAGE = join(REPO_ROOT, "apps/indusk-mcp");
const SKILLS = ["otel", "testing", "local-telemetry"].map((n) => `extensions/${n}/skill.md`);
const LOGGER = "templates/logger.ts";

const read = (rel: string) => readFileSync(join(PACKAGE, rel), "utf-8");

/** A line that puts business events or measurements beside a log level or the word log. */
const LOG_AS_SIGNAL =
	/(?=.*\b(?:business events?|measurements?)\b)(?=.*\b(?:info|warn|error|debug|logs?|logging|log records?)\b)/i;

describe("log-line-not-signal", () => {
	it("T18: no log line is called the home of business events or measurements", () => {
		const problems: string[] = [];
		for (const rel of [LOGGER, ...SKILLS]) {
			read(rel)
				.split("\n")
				.forEach((line, i) => {
					if (LOG_AS_SIGNAL.test(line)) problems.push(`${rel}:${i + 1}  ${line.trim()}`);
				});
		}
		expect(problems).toEqual([]);
	});

	it("T18: each skill says a promise's signal is a span and names the helper's call", () => {
		const problems: string[] = [];
		for (const rel of SKILLS) {
			const text = read(rel);
			if (!/signal is a span/i.test(text)) problems.push(`${rel} never says a signal is a span`);
			if (!text.includes("signal.upheld")) problems.push(`${rel} never names signal.upheld`);
		}
		expect(problems).toEqual([]);
	});

	it("T18: the otel skill's log-correlation example returns the keys the log transport reads", () => {
		const text = read("extensions/otel/skill.md");
		const missing = ["trace_id", "span_id", "trace_flags"].filter((key) => !text.includes(key));
		expect(missing, "the correlation example lacks these keys").toEqual([]);
	});
});
