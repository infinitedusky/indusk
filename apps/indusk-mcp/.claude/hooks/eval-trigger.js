#!/usr/bin/env node

/**
 * PostToolUse hook: triggers the eval judge after `jj describe`.
 *
 * Fires on Bash tool calls containing "jj describe". Spawns the judge runner
 * as a detached background process and exits immediately — never blocks the
 * working session.
 *
 * Exit 0 always — this is advisory, not blocking.
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Read hook input from stdin
let input = "";
for await (const chunk of process.stdin) {
	input += chunk;
}

const event = JSON.parse(input);
const toolInput = event.tool_input ?? {};
const command = toolInput.command ?? "";

// Fast path: not a jj describe command
if (!command.includes("jj describe")) {
	process.exit(0);
}

/**
 * Find the project root by walking up looking for .indusk/ or .claude/.
 */
function findProjectRoot(startDir) {
	let dir = startDir;
	for (let i = 0; i < 10; i++) {
		if (existsSync(`${dir}/.indusk`) || existsSync(`${dir}/.claude`)) return dir;
		const parent = resolve(dir, "..");
		if (parent === dir) break;
		dir = parent;
	}
	return startDir;
}

/**
 * Read eval config from .indusk/config.json.
 */
function readEvalConfig(projectRoot) {
	const configPath = `${projectRoot}/.indusk/config.json`;
	if (!existsSync(configPath)) return { enabled: true, endpoint: null };
	try {
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		return {
			enabled: config?.eval?.enabled !== false, // default: true
			endpoint: config?.eval?.endpoint ?? null,
		};
	} catch {
		return { enabled: true, endpoint: null };
	}
}

const projectRoot = findProjectRoot(event.cwd ?? process.cwd());
const evalConfig = readEvalConfig(projectRoot);

// Check if eval is disabled
if (!evalConfig.enabled) {
	process.exit(0);
}

// Get the current change ID
let changeId;
try {
	changeId = execSync("jj log -r @ --no-graph -T change_id", {
		cwd: projectRoot,
		encoding: "utf8",
		timeout: 5000,
	}).trim();
} catch {
	// Can't get change ID — skip eval silently
	process.exit(0);
}

// Find the transcript path.
// Claude Code provides CLAUDE_TRANSCRIPT_PATH in the environment when hooks run,
// or we can search for the most recent transcript.
const transcriptPath =
	process.env.CLAUDE_TRANSCRIPT_PATH ?? process.env.TRANSCRIPT_PATH ?? "(transcript unavailable)";

// Find the indusk-mcp package — resolve from the hook's own location.
// The hook lives at .claude/hooks/eval-trigger.js but was copied from the package's hooks/ dir.
// Try multiple resolution strategies:
// 1. Relative to the hook's original package location (when run from the package source)
// 2. Via npx cache / global install
// 3. Via the project's node_modules
const hookDir = dirname(fileURLToPath(import.meta.url));
const candidates = [
	// Source repo (apps/indusk-mcp/hooks/ → apps/indusk-mcp/dist/)
	resolve(hookDir, "../dist/lib/eval/judge-runner.js"),
	// Installed package (hooks/ → dist/)
	resolve(hookDir, "../../node_modules/@infinitedusky/indusk-mcp/dist/lib/eval/judge-runner.js"),
	// Global npx cache
	...(() => {
		try {
			const which = execSync("which indusk", { encoding: "utf8" }).trim();
			if (which)
				return [
					resolve(
						dirname(which),
						"../lib/node_modules/@infinitedusky/indusk-mcp/dist/lib/eval/judge-runner.js",
					),
				];
		} catch {}
		return [];
	})(),
];
let judgeRunnerPath = null;
for (const c of candidates) {
	if (existsSync(c)) {
		judgeRunnerPath = c;
		break;
	}
}

if (!judgeRunnerPath) {
	// Can't find the package — log error and exit
	const { mkdirSync, appendFileSync } = await import("node:fs");
	const logPath = resolve(projectRoot, ".indusk", "eval", "results.log");
	mkdirSync(dirname(logPath), { recursive: true });
	const entry = JSON.stringify({
		version: 1,
		timestamp: new Date().toISOString(),
		mode: "eval",
		changeId,
		error: true,
		message:
			"Could not find @infinitedusky/indusk-mcp package — eval judge not available. Run: npm i -g @infinitedusky/indusk-mcp",
	});
	appendFileSync(logPath, entry + "\n", "utf8");
	process.exit(0);
}

// Spawn a detached node process that calls runJudgeSync (which awaits completion).
const judgeScript = `
import("${judgeRunnerPath}")
  .then(m => m.runJudgeSync({
    projectRoot: ${JSON.stringify(projectRoot)},
    changeId: ${JSON.stringify(changeId)},
    transcriptPath: ${JSON.stringify(transcriptPath)},
    mode: "eval",
    evalEndpoint: ${JSON.stringify(evalConfig.endpoint)},
  }))
  .then(() => process.exit(0))
  .catch(err => {
    const fs = require("fs");
    const path = require("path");
    const logPath = path.join(${JSON.stringify(projectRoot)}, ".indusk", "eval", "results.log");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const entry = JSON.stringify({
      version: 1,
      timestamp: new Date().toISOString(),
      mode: "eval",
      changeId: ${JSON.stringify(changeId)},
      error: true,
      message: err.message || String(err),
    });
    fs.appendFileSync(logPath, entry + "\\n", "utf8");
    process.exit(1);
  });
`;

const child = spawn("node", ["--input-type=module", "-e", judgeScript], {
	cwd: projectRoot,
	stdio: "ignore",
	detached: true,
	env: { ...process.env },
});

child.unref();

// Output advisory message
const output = JSON.stringify({
	hookSpecificOutput: {
		hookEventName: "PostToolUse",
		message: `Eval judge spawned for change ${changeId.slice(0, 8)}`,
	},
});
process.stdout.write(output);
process.stderr.write(
	`📊 Eval judge spawned in background for ${changeId.slice(0, 8)}. Results will appear in .indusk/eval/results.log\n`,
);

process.exit(0);
