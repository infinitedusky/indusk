import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openIncidentSpec } from "../../__tests__/helpers/promises-fixture.js";
import { recordBreaks } from "./record.js";
import { answering, jsonLines, PROMISE, recordingProject } from "./record.test-support.js";
import { JaegerUnreachable } from "./sources.js";

/**
 * incident-recording A14 — promise: an-open-incident-stays-loud.
 *
 * An incident open longer than a day is announced again — in the agent's
 * inbox always, and in Slack when the project names a webhook variable
 * (`promises.slack_webhook_env`) — once a day, not again the same day, across
 * restarts (the last announcement is kept in the home), and not at all once
 * it is fixed. A pass whose source cannot be read still reminds: reminders
 * read only the registry.
 */

const ID = "i-2026-10-06-seat-released";
const OPENED = new Date("2026-10-07T19:00:00Z");
const hours = (h: number) => new Date(OPENED.getTime() + h * 3_600_000);
const WEBHOOK_ENV = "IR_TEST_SLACK_WEBHOOK";

let home: string;
let posts: { webhook: string; text: string }[];
const cleanups: (() => void)[] = [];
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "reminders-home-"));
	posts = [];
	cleanups.push(() => rmSync(home, { recursive: true, force: true }));
});
afterEach(() => {
	for (const c of cleanups.splice(0).reverse()) c();
});

function project(opts: { fixed?: boolean; webhook?: boolean } = {}) {
	const fx = recordingProject({
		incidents: [
			openIncidentSpec(ID, PROMISE, {
				opened: OPENED.toISOString(),
				date: "2026-10-07",
				...(opts.fixed
					? {
							status: "fixed",
							fixed: "2026-10-08T09:00:00Z",
							rootCause: "Timer.",
							fix: "Armed it.",
						}
					: {}),
			}),
		],
		extraPromises: opts.webhook === false ? {} : { slack_webhook_env: WEBHOOK_ENV },
	});
	cleanups.push(fx.cleanup);
	return fx;
}

const deps = (reads = answering([])) => ({
	reads,
	mark: () => {},
	home,
	env: { [WEBHOOK_ENV]: "https://hooks.slack.example/T/B/x" },
	post: async (webhook: string, text: string) => {
		posts.push({ webhook, text });
	},
});

const reminders = () =>
	jsonLines<{ kind: string; incident: string }>(home, "inbox.jsonl").filter(
		(e) => e.kind === "reminder",
	);

describe("A14 — an incident open past a day is announced again, once a day", () => {
	it("is reminded in the inbox and in Slack once past a day, and not again that day", async () => {
		const fx = project();
		await recordBreaks(fx.root, { by: "admin", source: "deployed", now: hours(12) }, deps());
		expect(reminders()).toEqual([]);
		await recordBreaks(fx.root, { by: "admin", source: "deployed", now: hours(25) }, deps());
		expect(reminders()).toEqual([expect.objectContaining({ incident: ID })]);
		expect(posts).toEqual([
			{ webhook: "https://hooks.slack.example/T/B/x", text: expect.stringContaining(ID) },
		]);
		await recordBreaks(fx.root, { by: "admin", source: "deployed", now: hours(26) }, deps());
		expect(reminders()).toHaveLength(1);
		expect(posts).toHaveLength(1);
		await recordBreaks(fx.root, { by: "admin", source: "deployed", now: hours(49) }, deps());
		expect(reminders()).toHaveLength(2);
		expect(posts).toHaveLength(2);
	});

	it("a fixed incident is never reminded", async () => {
		const fx = project({ fixed: true });
		await recordBreaks(fx.root, { by: "admin", source: "deployed", now: hours(30) }, deps());
		expect(reminders()).toEqual([]);
		expect(posts).toEqual([]);
	});

	it("with no webhook named, the reminder goes to the inbox only", async () => {
		const fx = project({ webhook: false });
		await recordBreaks(fx.root, { by: "admin", source: "deployed", now: hours(25) }, deps());
		expect(reminders()).toHaveLength(1);
		expect(posts).toEqual([]);
	});

	it("a pass that cannot read its source still reminds", async () => {
		const fx = project();
		const unreachable = async () => {
			throw new JaegerUnreachable("https://jaeger.example", "connect ECONNREFUSED");
		};
		await recordBreaks(
			fx.root,
			{ by: "admin", source: "deployed", now: hours(25) },
			deps(unreachable as never),
		);
		expect(reminders()).toHaveLength(1);
	});
});
