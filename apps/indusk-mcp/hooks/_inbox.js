/**
 * The hook-side port of `src/lib/promises/inbox.ts` (incident-recording):
 * which inbox entries a session has not been given, which are still open,
 * and one per incident — `undelivered` — and marking them delivered. A hook
 * cannot import the TS library, so this is its one copy, pinned by
 * `hook-shared-modules.test.ts` A33; change the two together.
 *
 * promise: a-break-reaches-the-working-agent
 * promise: one-definition-per-shared-rule
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const INBOX_FILE = "inbox.jsonl";
const DELIVERED_FILE = "inbox-delivered.jsonl";

/**
 * What `session` has not been given yet: `entries` to say (one per incident
 * `isOpen` says is open, the newest), `ids` to mark delivered (every fresh
 * entry, said or not), and `problems` (lines that could not be read).
 * @param {string} home
 * @param {string} session
 * @param {{ isOpen?: (incident: string) => boolean }} [opts]
 */
export function undelivered(home, session, opts = {}) {
	const inbox = readLines(join(home, INBOX_FILE));
	const delivered = new Set(
		readLines(join(home, DELIVERED_FILE))
			.values.filter((v) => v && (v.session === undefined || v.session === session))
			.map((v) => v.id),
	);
	const fresh = inbox.values.filter((e) => e && typeof e.id === "string" && !delivered.has(e.id));
	const isOpen = opts.isOpen ?? (() => true);
	const open = fresh.filter((e) => isOpen(e.incident));
	return {
		entries: [...new Map(open.map((e) => [e.incident, e])).values()],
		ids: fresh.map((e) => e.id),
		problems: inbox.problems,
	};
}

/**
 * @param {string} home
 * @param {string[]} ids
 * @param {string} session
 */
export function markDelivered(home, ids, session) {
	if (ids.length === 0) return;
	appendFileSync(
		join(home, DELIVERED_FILE),
		`${ids.map((id) => JSON.stringify({ id, session })).join("\n")}\n`,
	);
}

function readLines(path) {
	if (!existsSync(path)) return { values: [], problems: [] };
	const values = [];
	const problems = [];
	let text;
	try {
		text = readFileSync(path, "utf-8");
	} catch (err) {
		return { values, problems: [`${path}: ${err.message}`] };
	}
	text.split("\n").forEach((line, i) => {
		if (!line.trim()) return;
		try {
			values.push(JSON.parse(line));
		} catch {
			problems.push(`${path}:${i + 1} is not JSON`);
		}
	});
	return { values, problems };
}
