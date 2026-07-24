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
import { withLock } from "../../lib/agents/lock.js";
import { getSessionId, sanitizeSessionId } from "../../lib/agents/session.js";
import { sweepStaleSections } from "../../lib/agents/sweep.js";
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

/** Worktree toplevel path for a cwd. "" when not in a git repo. */
function currentWorktree(cwd: string): string {
	const res = spawnSync("git", ["rev-parse", "--show-toplevel"], {
		cwd,
		encoding: "utf-8",
	});
	if (res.status !== 0) return "";
	return (res.stdout ?? "").trim();
}

function currentMdPath(projectRoot: string): string {
	return join(projectRoot, ".indusk/current.md");
}

function currentMdLockPath(projectRoot: string): string {
	return `${currentMdPath(projectRoot)}.lock`;
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
	const cwd = opts.worktree ?? process.cwd();
	const branch = opts.branch ?? currentBranch(cwd) ?? "";
	const worktree = currentWorktree(cwd);
	withLock(currentMdLockPath(projectRoot), () => {
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
			branch,
			worktree,
		};
		const updated = upsertSection(initial, section);
		writeAtomic(projectRoot, updated, sessionId);
		console.info(`Registered agent ${sessionId} — ${section.task}`);
	});
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
	withLock(currentMdLockPath(projectRoot), () => {
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
	});
}

/** Basename of a worktree path, for a narrow table cell. "" → "—". */
function worktreeCell(worktree: string): string {
	if (!worktree) return "—";
	const parts = worktree.split("/").filter(Boolean);
	return parts.length ? parts[parts.length - 1] : worktree;
}

type TableRow = {
	session: string;
	task: string;
	worktree: string;
	branch: string;
	started: string;
};

function formatTable(entries: AgentSection[]): string {
	if (entries.length === 0) return "(no agents currently registered)";
	const rows: TableRow[] = entries.map((e) => ({
		session: e.sessionShort,
		task: e.task,
		worktree: worktreeCell(e.worktree),
		branch: e.branch || "—",
		started: e.lastUpdated.slice(0, 19).replace("T", " "),
	}));
	const headers: TableRow = {
		session: "SESSION",
		task: "TASK",
		worktree: "WORKTREE",
		branch: "BRANCH",
		started: "LAST UPDATED",
	};
	const cols: (keyof TableRow)[] = ["session", "task", "worktree", "branch", "started"];
	const widths = Object.fromEntries(
		cols.map((c) => [c, Math.max(headers[c].length, ...rows.map((r) => r[c].length))]),
	) as Record<keyof TableRow, number>;
	const pad = (s: string, w: number) => s.padEnd(w);
	const line = (r: TableRow) => cols.map((c) => pad(r[c], widths[c])).join("  ");
	const out = [line(headers), cols.map((c) => "-".repeat(widths[c])).join("  ")];
	for (const r of rows) out.push(line(r));
	return out.join("\n");
}

/**
 * Same-tree collision detection: group fresh sessions by resolved worktree
 * toplevel; any tree shared by ≥2 live sessions is flagged (the real case being
 * two agents both sitting in the shared trunk). Sessions with no resolvable
 * worktree (non-git cwd) are excluded — can't determine a shared tree.
 *
 * Eventual-consistency semantics (falsification H1): the verdict compares each
 * session's LAST-KNOWN tree. Only the calling session's tree is recomputed live
 * (in `agentList`'s heartbeat) — every other session's tree is whatever it last
 * wrote via `agent register` / `agent list`. A session that moved between the
 * trunk and a worktree but hasn't run an `agent` command since carries a stale
 * tree, so a collision can be flagged (or cleared) a beat late. This is inherent
 * — you can't run git in another session's cwd — and self-corrects on that
 * session's next heartbeat. Not a bug; documented so it isn't mistaken for one.
 */
function detectCollisions(entries: AgentSection[]): string[] {
	const byTree = new Map<string, AgentSection[]>();
	for (const e of entries) {
		if (!e.worktree) continue;
		const group = byTree.get(e.worktree) ?? [];
		group.push(e);
		byTree.set(e.worktree, group);
	}
	const warnings: string[] = [];
	for (const [tree, group] of byTree) {
		if (group.length >= 2) {
			const who = group.map((g) => g.sessionShort).join(", ");
			warnings.push(`⚠ collision: ${group.length} sessions share worktree ${tree} (${who})`);
		}
	}
	return warnings;
}

export function agentList(projectRoot: string): void {
	withLock(currentMdLockPath(projectRoot), () => {
		const initial = readCurrent(projectRoot);
		const ttl = getStaleTtlMinutes(projectRoot);
		const { fresh } = listSections(initial, ttl);
		// Self-heartbeat — refresh the caller's own section's lastUpdated by re-upserting it.
		// Preserves the heartbeat semantics from the parent plan: asking who's around implicitly
		// says "I am still here." Also RECOMPUTES branch/worktree from cwd (not the register-time
		// snapshot) so the who-is-where board never drifts as the agent moves between trees.
		// Silent if the caller has no section yet.
		try {
			const sessionId = getSessionId();
			const callerSection = fresh.find((s) => s.sessionId === sessionId);
			if (callerSection) {
				const cwd = process.cwd();
				// Recompute from cwd — but PRESERVE the last-known value when the
				// recompute comes back empty (non-git cwd). The workbench root is
				// intentionally not a git repo and is exactly where `.indusk/` lives,
				// so running `agent list` there must NOT wipe the caller's worktree/
				// branch to "" — that would drop the session off the board and out of
				// the collision check (falsification T10, 2026-07-13).
				const freshWorktree = currentWorktree(cwd);
				const freshBranchRaw = currentBranch(cwd);
				const nextWorktree = freshWorktree || callerSection.worktree;
				const nextBranch = freshBranchRaw ?? (callerSection.branch || "");
				callerSection.branch = nextBranch;
				callerSection.worktree = nextWorktree;
				const touched = upsertSection(initial, {
					...callerSection,
					branch: nextBranch,
					worktree: nextWorktree,
					lastUpdated: new Date().toISOString(),
				});
				writeAtomic(projectRoot, touched, sessionId);
			}
		} catch {
			// Sanitizer rejection or other failure — skip heartbeat silently. List output below is unaffected.
		}
		const collisions = detectCollisions(fresh);
		if (collisions.length > 0) {
			for (const w of collisions) console.warn(w);
		}
		console.info(formatTable(fresh));
	});
}

export function agentPrune(projectRoot: string): void {
	withLock(currentMdLockPath(projectRoot), () => {
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
	});
}

export interface AgentSweepOptions {
	dryRun?: boolean;
}

/**
 * `indusk agent sweep [--dry-run]` — move sections older than the sweep TTL
 * (`agents.sweep_ttl_minutes`, default 7 days) into
 * `.indusk/archive/current-md-archive.md`. Unlike `prune` (which drops stale
 * sections by the 60-minute DISPLAY TTL), sweep archives by the much longer
 * DECAY TTL and never deletes — recovery is a copy from the archive file.
 */
export function agentSweep(projectRoot: string, opts: AgentSweepOptions = {}): void {
	const result = sweepStaleSections(projectRoot, { dryRun: opts.dryRun });
	if (result.swept.length === 0) {
		console.info("Nothing to sweep — no sections older than the sweep TTL.");
		return;
	}
	const verb = result.dryRun ? "Would sweep" : "Swept";
	console.info(`${verb} ${result.swept.length} section(s) → ${result.archivePath}`);
	for (const s of result.swept) {
		console.info(`  - ${s.sessionShort} — ${s.task} (last updated ${s.lastUpdated})`);
	}
	if (result.keptMalformed > 0) {
		console.info(`Kept ${result.keptMalformed} section(s) with unparseable timestamps.`);
	}
}
