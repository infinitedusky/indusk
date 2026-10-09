import { describe, expect, it } from "vitest";
import { redactingWriter } from "./redact.js";

/**
 * server-provisioning A9 (the writer both commands print through).
 *
 * promise: provisioning-never-prints-a-secret
 */
describe("A9 — the redacting writer", () => {
	it("replaces every secret wherever it appears, including inside a provider's own output", () => {
		const lines: string[] = [];
		const out = redactingWriter(
			(l) => lines.push(l),
			["pw-1", "https://hooks.slack.com/services/T/B/x"],
		);
		out.line(
			"fly: set INDUSK_SERVER_PASSWORD=pw-1 and INDUSK_SERVER_SLACK_WEBHOOK=https://hooks.slack.com/services/T/B/x",
		);
		out.line("error: pw-1 rejected");
		expect(lines.join("\n")).not.toContain("pw-1");
		expect(lines.join("\n")).not.toContain("hooks.slack.com/services/T/B/x");
		expect(lines[0]).toContain("INDUSK_SERVER_PASSWORD=[redacted]");
	});

	it("an empty secret redacts nothing rather than everything", () => {
		const lines: string[] = [];
		redactingWriter((l) => lines.push(l), ["", "pw-1"]).line("plain line");
		expect(lines).toEqual(["plain line"]);
	});
});
