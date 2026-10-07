import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { gitCommonDirOf } from "../worktree/layout.js";

/**
 * Claude Code's trust for a plan's worktree (admin-plan-authoring; Sandy,
 * 2026-10-06: "trust automatic").
 *
 * Claude Code ignores a project's own allow-list until the project is trusted
 * (`hasTrustDialogAccepted` in `~/.claude.json`), and every plan's worktree is
 * a new path it has never seen. A worktree of a project the developer already
 * trusts is trusted like it; a project nobody trusted never is. Only that one
 * key is written, and a config that cannot be read is left alone.
 *
 * The write is a read-modify-rename, so a reader never sees half a file. Claude
 * Code also writes this file; a write of its own landing between our read and
 * our rename would be lost. The window is milliseconds, once per new worktree.
 */

export type TrustOutcome = "trusted" | "already" | "untrusted";

const defaultConfig = () => join(homedir(), ".claude.json");

type ClaudeConfig = { projects?: Record<string, Record<string, unknown>> };

function readConfig(path: string): ClaudeConfig | null {
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as ClaudeConfig;
	} catch {
		return null;
	}
}

/** Whether Claude Code has trusted `cwd`: its own record, nothing inferred. */
export function isTrusted(cwd: string, claudeConfig = defaultConfig()): boolean {
	return readConfig(claudeConfig)?.projects?.[cwd]?.hasTrustDialogAccepted === true;
}

/** Trust `worktree` because `project` is trusted; never otherwise. */
export function trustLikeProject(
	worktree: string,
	project: string,
	claudeConfig = defaultConfig(),
): TrustOutcome {
	const config = readConfig(claudeConfig);
	if (!config) return "untrusted";
	const projects = config.projects ?? {};
	if (projects[worktree]?.hasTrustDialogAccepted === true) return "already";
	if (worktree === project || projects[project]?.hasTrustDialogAccepted !== true)
		return "untrusted";
	return writeTrust(config, worktree, claudeConfig);
}

/**
 * Trust `path` because the person asked, from the admin's "Trust in Claude
 * Code" (workbench-plan-authoring D12). The click is the consent, as
 * accepting Claude Code's own prompt is.
 */
export function trustProject(path: string, claudeConfig = defaultConfig()): TrustOutcome {
	const config = existsSync(claudeConfig) ? readConfig(claudeConfig) : {};
	if (!config) return "untrusted";
	if (config.projects?.[path]?.hasTrustDialogAccepted === true) return "already";
	return writeTrust(config, path, claudeConfig);
}

/** The one write: `path`'s `hasTrustDialogAccepted`, by read-modify-rename. */
function writeTrust(config: ClaudeConfig, path: string, claudeConfig: string): TrustOutcome {
	const projects = config.projects ?? {};
	const next = {
		...config,
		projects: { ...projects, [path]: { ...projects[path], hasTrustDialogAccepted: true } },
	};
	const temp = `${claudeConfig}.indusk-${process.pid}`;
	writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`);
	renameSync(temp, claudeConfig);
	return "trusted";
}

/** The main working tree of the repository `cwd` is in, or `cwd` when git cannot say. */
export function projectOf(cwd: string): string {
	const common = gitCommonDirOf(cwd);
	return common ? dirname(common) : cwd;
}
