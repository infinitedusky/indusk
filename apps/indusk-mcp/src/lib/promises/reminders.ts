import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readConfig } from "../config.js";
import { appendInbox } from "./inbox.js";
import type { IncidentEntry, Registry } from "./registry.js";
import { maintenanceHeadingName } from "./reopen.js";
import { postToSlack } from "./slack.js";

/**
 * An open incident stays loud (incident-recording, ADR D7): one open longer
 * than a day is announced again — to the agent's inbox always, and to Slack
 * when the project names a webhook variable (`promises.slack_webhook_env`) —
 * once a day until it is fixed. When each was last announced is kept in the
 * project's home (`announced.json`), written after Slack accepts, as the
 * server's announce-once record is, so a restart never repeats a reminder and
 * a post that failed is tried again on the next pass.
 *
 * Reads only the registry: a pass whose source cannot be read still reminds.
 *
 * promise: an-open-incident-stays-loud
 */

export const ANNOUNCED_FILE = "announced.json";
export const DAY_MS = 86_400_000;
const SLACK_TIMEOUT_MS = 5_000;

type Announced = Record<string, string>;

export interface ReminderDeps {
	post?: (webhook: string, text: string) => Promise<void>;
	env?: NodeJS.ProcessEnv;
}

/** The open incidents due a reminder at `now`: open past `after`, and last announced longer than `every` ago. */
export function dueReminders(
	incidents: IncidentEntry[],
	announced: Announced,
	now: Date,
	opts: { after: number; every: number } = { after: DAY_MS, every: DAY_MS },
): IncidentEntry[] {
	return incidents.filter((i) => {
		if (i.status !== "open" || !i.opened) return false;
		if (now.getTime() - Date.parse(i.opened) < opts.after) return false;
		const last = announced[i.id];
		return !last || now.getTime() - Date.parse(last) >= opts.every;
	});
}

export async function remind(
	planRoot: string,
	registry: Registry,
	home: string,
	now: Date,
	deps: ReminderDeps,
): Promise<string[]> {
	const announced = readAnnounced(home);
	const due = dueReminders(registry.incidents, announced, now);
	if (due.length === 0) return [];
	const webhook = webhookFor(planRoot, deps.env ?? process.env);
	const reminded: string[] = [];
	for (const incident of due) {
		const owner = registry.promises.find((p) => p.name === incident.promise)?.owner ?? "";
		const phase = maintenanceHeadingName(incident.id);
		if (webhook && deps.post) {
			try {
				await deps.post(webhook, reminderText(incident, owner, phase, now));
			} catch {
				continue; // not recorded as announced: the next pass tries again
			}
		}
		appendInbox(
			home,
			[{ kind: "reminder", promise: incident.promise, incident: incident.id, owner, phase }],
			now,
		);
		announced[incident.id] = now.toISOString();
		reminded.push(incident.id);
	}
	writeAnnounced(home, announced);
	return reminded;
}

/** The real post, through the one Slack sender. */
export function slackPost(webhook: string, text: string): Promise<void> {
	return postToSlack(webhook, text, SLACK_TIMEOUT_MS);
}

function reminderText(incident: IncidentEntry, owner: string, phase: string, now: Date): string {
	const days = Math.floor((now.getTime() - Date.parse(incident.opened ?? "")) / DAY_MS);
	return `:rotating_light: \`${incident.promise}\` — incident ${incident.id} has been open ${days} day${days === 1 ? "" : "s"}. ${owner} carries ${phase}.`;
}

function webhookFor(planRoot: string, env: NodeJS.ProcessEnv): string | null {
	const name = (readConfig(planRoot) as { promises?: { slack_webhook_env?: unknown } } | null)
		?.promises?.slack_webhook_env;
	if (typeof name !== "string" || !name) return null;
	return env[name] || null;
}

function readAnnounced(home: string): Announced {
	const path = join(home, ANNOUNCED_FILE);
	if (!existsSync(path)) return {};
	try {
		const data = JSON.parse(readFileSync(path, "utf-8"));
		return data && typeof data === "object" && !Array.isArray(data) ? (data as Announced) : {};
	} catch {
		return {};
	}
}

function writeAnnounced(home: string, announced: Announced): void {
	mkdirSync(home, { recursive: true });
	const path = join(home, ANNOUNCED_FILE);
	writeFileSync(`${path}.tmp`, `${JSON.stringify(announced, null, 2)}\n`);
	renameSync(`${path}.tmp`, path);
}
