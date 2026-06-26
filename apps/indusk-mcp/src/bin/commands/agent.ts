import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { getAgentsDir, getPresenceFilePath } from "../../lib/agents/paths.js";
import { getSessionId } from "../../lib/agents/session.js";
import type { PresenceFile } from "../../lib/agents/types.js";
import { readConfig } from "../../lib/config.js";

/**
 * `indusk agent` — multi-agent presence bulletin CLI.
 *
 * Four subcommands:
 *   register --task "<what>" [--branch <b>] [--worktree <p>]
 *     Writes <projectRoot>/.indusk/agents/<sessionId>.md with a frontmatter
 *     block + a small markdown body describing the session.
 *   done [--session-id <id>]
 *     Removes the presence file for the current (or named) session. Silent
 *     no-op if the file is already gone.
 *   list
 *     Globs the directory, filters by mtime against agents.stale_ttl_minutes
 *     (default 60), prints a compact table.
 *   prune
 *     Removes every stale file unconditionally. Prints what was removed.
 *
 * The TTL is read from `.indusk/config.json`'s `agents.stale_ttl_minutes`
 * field; if absent, defaults to DEFAULT_STALE_TTL_MINUTES (60).
 *
 * Concurrency: register/done write/delete only the current session's own
 * file. list/prune are read-side or remove-only. There is no shared mutation
 * surface across concurrent agents — the directory listing is the only
 * shared state, and it changes by file-create / file-delete (POSIX atomic).
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

function serializePresenceFile(presence: PresenceFile): string {
	const body = [
		`# Agent presence — ${presence.sessionId}`,
		"",
		`**Task:** ${presence.task}`,
		`**Branch:** ${presence.branch ?? "(detached or unknown)"}`,
		`**Worktree:** ${presence.worktree}`,
		`**Started:** ${presence.startedAt}`,
		"",
	].join("\n");
	return matter.stringify(body, presence as unknown as Record<string, unknown>);
}

function parsePresenceFile(path: string): PresenceFile | null {
	try {
		const raw = readFileSync(path, "utf-8");
		const parsed = matter(raw);
		const data = parsed.data as Partial<PresenceFile>;
		if (typeof data.sessionId !== "string" || typeof data.task !== "string") {
			return null;
		}
		return {
			sessionId: data.sessionId,
			task: data.task,
			branch: data.branch ?? null,
			worktree: data.worktree ?? "",
			startedAt: data.startedAt ?? "",
		};
	} catch {
		return null;
	}
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
	const sessionId = getSessionId();
	const branch = opts.branch ?? currentBranch(opts.worktree ?? process.cwd());
	const worktree = opts.worktree ?? process.cwd();
	const presence: PresenceFile = {
		sessionId,
		task: opts.task.trim(),
		branch,
		worktree,
		startedAt: new Date().toISOString(),
	};
	const agentsDir = getAgentsDir(projectRoot);
	if (!existsSync(agentsDir)) mkdirSync(agentsDir, { recursive: true });
	const path = getPresenceFilePath(projectRoot, sessionId);
	writeFileSync(path, serializePresenceFile(presence));
	console.info(`Registered agent ${sessionId} — ${presence.task}`);
}

export interface AgentDoneOptions {
	sessionId?: string;
}

export function agentDone(projectRoot: string, opts: AgentDoneOptions): void {
	const sessionId = opts.sessionId ?? getSessionId();
	const path = getPresenceFilePath(projectRoot, sessionId);
	if (existsSync(path)) {
		rmSync(path, { force: true });
		console.info(`Agent ${sessionId} done.`);
	} else {
		console.info(`Agent ${sessionId} already done (no presence file).`);
	}
}

export interface AgentListEntry {
	presence: PresenceFile;
	mtimeMs: number;
	stale: boolean;
}

export function readBulletin(projectRoot: string): AgentListEntry[] {
	const agentsDir = getAgentsDir(projectRoot);
	if (!existsSync(agentsDir)) return [];
	const ttlMinutes = getStaleTtlMinutes(projectRoot);
	const ttlMs = ttlMinutes * 60 * 1000;
	const now = Date.now();
	const entries: AgentListEntry[] = [];
	for (const name of readdirSync(agentsDir)) {
		if (!name.endsWith(".md")) continue;
		const path = join(agentsDir, name);
		let mtimeMs = 0;
		try {
			mtimeMs = statSync(path).mtimeMs;
		} catch {
			continue;
		}
		const presence = parsePresenceFile(path);
		if (!presence) continue;
		entries.push({
			presence,
			mtimeMs,
			stale: now - mtimeMs > ttlMs,
		});
	}
	return entries;
}

function formatTable(entries: AgentListEntry[]): string {
	if (entries.length === 0) return "(no agents currently registered)";
	const rows = entries.map((e) => ({
		session: e.presence.sessionId.slice(0, 8),
		task: e.presence.task,
		branch: e.presence.branch ?? "—",
		started: e.presence.startedAt.slice(0, 19).replace("T", " "),
	}));
	const headers = { session: "SESSION", task: "TASK", branch: "BRANCH", started: "STARTED" };
	const widths = {
		session: Math.max(headers.session.length, ...rows.map((r) => r.session.length)),
		task: Math.max(headers.task.length, ...rows.map((r) => r.task.length)),
		branch: Math.max(headers.branch.length, ...rows.map((r) => r.branch.length)),
		started: Math.max(headers.started.length, ...rows.map((r) => r.started.length)),
	};
	const pad = (s: string, w: number) => s.padEnd(w);
	const line = (r: (typeof rows)[number]) =>
		`${pad(r.session, widths.session)}  ${pad(r.task, widths.task)}  ${pad(r.branch, widths.branch)}  ${pad(r.started, widths.started)}`;
	const out = [
		line(headers),
		line({
			...headers,
			...Object.fromEntries(
				Object.keys(widths).map((k) => [k, "-".repeat(widths[k as keyof typeof widths])]),
			),
		} as (typeof rows)[number]),
	];
	for (const r of rows) out.push(line(r));
	return out.join("\n");
}

export function agentList(projectRoot: string): void {
	const entries = readBulletin(projectRoot).filter((e) => !e.stale);
	console.info(formatTable(entries));
}

export function agentPrune(projectRoot: string): void {
	const agentsDir = getAgentsDir(projectRoot);
	if (!existsSync(agentsDir)) {
		console.info("No agents directory; nothing to prune.");
		return;
	}
	const stale = readBulletin(projectRoot).filter((e) => e.stale);
	for (const entry of stale) {
		const path = getPresenceFilePath(projectRoot, entry.presence.sessionId);
		rmSync(path, { force: true });
	}
	console.info(
		stale.length === 0
			? "No stale presence files to prune."
			: `Pruned ${stale.length} stale presence file(s).`,
	);
}
