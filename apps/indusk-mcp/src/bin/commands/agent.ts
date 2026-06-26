import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentSection } from "../../lib/agents/current-md.js";
import {
	listSections,
	parseCurrentMd,
	pruneStaleSections,
	removeSection,
	serializeCurrentMd,
	upsertSection,
} from "../../lib/agents/current-md.js";
import { getSessionId, sanitizeSessionId } from "../../lib/agents/session.js";
import { readConfig } from "../../lib/config.js";

/**
 * `indusk agent` — multi-agent presence bulletin CLI.
 *
 * After the section-shape rework (handoff-multi-agent-section-shape), the
 * bulletin lives as per-agent sections inside `.indusk/current.md` — there
 * is no separate `.indusk/agents/` directory.
 *
 * Four subcommands:
 *   register --task "<what>" [--branch <b>] [--worktree <p>]
 *     Calls `upsertSection` to ensure a section exists for the current
 *     session. If one already exists, refreshes the `Last updated` timestamp
 *     and task; preserves existing in-flight / open-questions / cursor
 *     bodies. This is the "I am here" surface.
 *   done [--session-id <id>]
 *     Calls `removeSection`. Silent no-op if no section matches.
 *   list
 *     Calls `listSections(content, ttl)` and prints the fresh partition as
 *     a compact table.
 *   prune
 *     Calls `pruneStaleSections(content, ttl)` and reports how many were
 *     removed.
 *
 * The TTL is read from `.indusk/config.json`'s `agents.stale_ttl_minutes`
 * field; if absent, defaults to DEFAULT_STALE_TTL_MINUTES (60).
 *
 * Concurrency: every mutation reads-modifies-writes the file via the
 * upsert/remove/prune helpers, then atomically renames a tmp file into
 * place. In-process race is impossible because each CLI invocation is its
 * own subprocess. Cross-branch race (two agents on two worktrees on two
 * branches) is git's job — different sections produce no merge conflict;
 * same-section overwrites resolve via normal git merge.
 */

const DEFAULT_STALE_TTL_MINUTES = 60;

interface AgentsConfigShape {
	stale_ttl_minutes?: number;
}

function getStaleTtlMinutes(projectRoot: string): number {
	const config = readConfig(projectRoot);
	const agentsConfig = (config as unknown as { agents?: AgentsConfigShape } | null)?.agents;
	if (
		agentsConfig &&
		typeof agentsConfig.stale_ttl_minutes === "number" &&
		agentsConfig.stale_ttl_minutes > 0
	) {
		return agentsConfig.stale_ttl_minutes;
	}
	return DEFAULT_STALE_TTL_MINUTES;
}

function currentBranch(cwd: string): string | null {
	const res = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
		cwd,
		encoding: "utf-8",
	});
	if (res.status !== 0) return null;
	const branch = (res.stdout ?? "").trim();
	if (!branch || branch === "HEAD") return null;
	return branch;
}

function currentMdPath(projectRoot: string): string {
	return join(projectRoot, ".indusk/current.md");
}

function readCurrent(projectRoot: string): string {
	const path = currentMdPath(projectRoot);
	if (!existsSync(path)) {
		// Bootstrap an empty doc so writes have somewhere to land. The init/update
		// scaffolding lands a template; this path is the "we're operating on a project
		// that hasn't seen init yet" fallback.
		return serializeCurrentMd({ preamble: "", sharedSection: "", sections: [] });
	}
	return readFileSync(path, "utf-8");
}

function writeAtomic(projectRoot: string, content: string, sessionId: string): void {
	const path = currentMdPath(projectRoot);
	const tmp = `${path}.tmp.${sessionId}`;
	writeFileSync(tmp, content);
	renameSync(tmp, path);
}

export interface AgentRegisterOptions {
	task: string;
	branch?: string;
	worktree?: string;
}

export function agentRegister(projectRoot: string, opts: AgentRegisterOptions): void {
	if (!opts.task || opts.task.trim().length === 0) {
		console.error("Error: --task is required");
		process.exit(1);
	}
	let sessionId: string;
	try {
		sessionId = getSessionId();
	} catch (err) {
		console.error(
			`Error: ${err instanceof Error ? err.message : String(err)} (rejected by sanitizer)`,
		);
		process.exit(1);
	}
	const branch = opts.branch ?? currentBranch(opts.worktree ?? process.cwd());
	const _branch = branch; // currently stored only for future use; sections don't carry branch yet
	void _branch;
	const initial = readCurrent(projectRoot);
	const doc = parseCurrentMd(initial);
	const existing = doc.sections.find((s) => s.sessionId === sessionId);
	const section: AgentSection = {
		sessionId,
		sessionShort: sessionId.slice(0, 8),
		task: opts.task.trim(),
		lastUpdated: new Date().toISOString(),
		inFlight: existing?.inFlight ?? "",
		openQuestions: existing?.openQuestions ?? "",
		cursor: existing?.cursor ?? "",
	};
	const updated = upsertSection(initial, section);
	writeAtomic(projectRoot, updated, sessionId);
	console.info(`Registered agent ${sessionId} — ${section.task}`);
}

export interface AgentDoneOptions {
	sessionId?: string;
}

export function agentDone(projectRoot: string, opts: AgentDoneOptions): void {
	let sessionId: string;
	try {
		sessionId = opts.sessionId ? sanitizeSessionId(opts.sessionId) : getSessionId();
	} catch (err) {
		console.error(
			`Error: ${err instanceof Error ? err.message : String(err)} (rejected by sanitizer)`,
		);
		process.exit(1);
	}
	const initial = readCurrent(projectRoot);
	const doc = parseCurrentMd(initial);
	const existed = doc.sections.some((s) => s.sessionId === sessionId);
	if (!existed) {
		console.info(`Agent ${sessionId} already done (no section in current.md).`);
		return;
	}
	const updated = removeSection(initial, sessionId);
	writeAtomic(projectRoot, updated, sessionId);
	console.info(`Agent ${sessionId} done.`);
}

function formatTable(entries: AgentSection[]): string {
	if (entries.length === 0) return "(no agents currently registered)";
	const rows = entries.map((e) => ({
		session: e.sessionShort,
		task: e.task,
		started: e.lastUpdated.slice(0, 19).replace("T", " "),
	}));
	const headers = { session: "SESSION", task: "TASK", started: "LAST UPDATED" };
	const widths = {
		session: Math.max(headers.session.length, ...rows.map((r) => r.session.length)),
		task: Math.max(headers.task.length, ...rows.map((r) => r.task.length)),
		started: Math.max(headers.started.length, ...rows.map((r) => r.started.length)),
	};
	const pad = (s: string, w: number) => s.padEnd(w);
	const line = (r: { session: string; task: string; started: string }) =>
		`${pad(r.session, widths.session)}  ${pad(r.task, widths.task)}  ${pad(r.started, widths.started)}`;
	const out = [
		line(headers),
		`${"-".repeat(widths.session)}  ${"-".repeat(widths.task)}  ${"-".repeat(widths.started)}`,
	];
	for (const r of rows) out.push(line(r));
	return out.join("\n");
}

export function agentList(projectRoot: string): void {
	const initial = readCurrent(projectRoot);
	const ttl = getStaleTtlMinutes(projectRoot);
	const { fresh } = listSections(initial, ttl);
	// Self-heartbeat — refresh the caller's own section's lastUpdated by re-upserting it.
	// Preserves the heartbeat semantics from the parent plan: asking who's around implicitly
	// says "I am still here." Silent if the caller has no section yet.
	try {
		const sessionId = getSessionId();
		const callerSection = fresh.find((s) => s.sessionId === sessionId);
		if (callerSection) {
			const touched = upsertSection(initial, {
				...callerSection,
				lastUpdated: new Date().toISOString(),
			});
			writeAtomic(projectRoot, touched, sessionId);
		}
	} catch {
		// Sanitizer rejection or other failure — skip heartbeat silently. List output below is unaffected.
	}
	console.info(formatTable(fresh));
}

export function agentPrune(projectRoot: string): void {
	const initial = readCurrent(projectRoot);
	const ttl = getStaleTtlMinutes(projectRoot);
	const { stale } = listSections(initial, ttl);
	if (stale.length === 0) {
		console.info("No stale sections to prune.");
		return;
	}
	const updated = pruneStaleSections(initial, ttl);
	// Use a stable identifier for the tmp filename — the prune call isn't tied to one session.
	const sessionId = (() => {
		try {
			return getSessionId();
		} catch {
			return `prune-${Date.now()}`;
		}
	})();
	writeAtomic(projectRoot, updated, sessionId);
	console.info(`Pruned ${stale.length} stale section(s).`);
}
