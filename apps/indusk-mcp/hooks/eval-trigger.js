#!/usr/bin/env node

/**
 * Dual-mode eval trigger. Works with both jj and plain git.
 *
 * 1) PostToolUse hook mode (default): fires on Bash tool calls containing
 *    `jj describe` (jj projects) or `git commit` (git projects). Reads the
 *    hook event JSON from stdin. Spawns the evaluator runner as a detached
 *    background process.
 *
 * 2) CLI mode (`--source <tag>`): invoked manually by skills (e.g., handoff)
 *    at session end. No stdin read, no trigger-command filter. Uses the
 *    current change/commit ID and passes the source tag to the evaluator
 *    via INDUSK_EVAL_SOURCE. The evaluator may skip diff-based scoring when
 *    source != "commit" but still processes the highlights queue.
 *
 * SCM detection: tries jj first (`jj log -r @`), falls back to git
 * (`git rev-parse --short HEAD`) on jj failure. Mirrors the runtime
 * detection pattern used by `apps/indusk-mcp/src/lib/scm/index.ts`.
 *
 * Exit 0 always — this is advisory, not blocking.
 */

import { execSync, spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// System log — writes to .indusk/eval/system.log for full visibility into eval lifecycle
function syslog(projectRoot, msg) {
	try {
		const logDir = resolve(projectRoot || ".", ".indusk", "eval");
		mkdirSync(logDir, { recursive: true });
		appendFileSync(resolve(logDir, "system.log"), `${new Date().toISOString()} ${msg}\n`);
	} catch {
		// ignore — logging should never break the hook
	}
}

// Parse --source <tag> from argv. Returns null if not in CLI mode.
function parseSourceArg(argv) {
	const idx = argv.indexOf("--source");
	if (idx === -1 || idx === argv.length - 1) return null;
	const value = argv[idx + 1];
	if (!value || value.startsWith("--")) return null;
	return value;
}

const cliSource = parseSourceArg(process.argv);
let cwd;
let command = "";

if (cliSource !== null) {
	// CLI mode — no stdin, no jj describe / git commit filter
	cwd = process.cwd();
	syslog(cwd, `cli invocation — source: ${cliSource}`);
} else {
	// Hook mode — read event from stdin
	let input = "";
	for await (const chunk of process.stdin) {
		input += chunk;
	}

	const event = JSON.parse(input);
	const toolInput = event.tool_input ?? {};
	command = toolInput.command ?? "";
	cwd = event.cwd ?? process.cwd();

	syslog(cwd, `hook fired — tool: ${event.tool_name}, command: ${command.slice(0, 100)}`);

	// Fast path: not a recognized commit-trigger command. The hook fires on
	// `jj describe` (jj projects) AND `git commit` (git projects) — match
	// either, skip otherwise.
	const triggerPatterns = ["jj describe", "git commit"];
	if (!triggerPatterns.some((p) => command.includes(p))) {
		syslog(cwd, "skip — no jj describe / git commit in command");
		process.exit(0);
	}
}

const source = cliSource ?? "commit";

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

const projectRoot = findProjectRoot(cwd);
const evalConfig = readEvalConfig(projectRoot);

syslog(projectRoot, `projectRoot: ${projectRoot}, eval.enabled: ${evalConfig.enabled}`);

// Check if eval is disabled
if (!evalConfig.enabled) {
	syslog(projectRoot, "skip — eval disabled in config");
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
	resolve(hookDir, "../dist/lib/eval/evaluator-runner.js"),
	// Installed package (hooks/ → dist/)
	resolve(
		hookDir,
		"../../node_modules/@infinitedusky/indusk-mcp/dist/lib/eval/evaluator-runner.js",
	),
	// Global npx cache
	...(() => {
		try {
			const which = execSync("which indusk", { encoding: "utf8" }).trim();
			if (which)
				return [
					resolve(
						dirname(which),
						"../lib/node_modules/@infinitedusky/indusk-mcp/dist/lib/eval/evaluator-runner.js",
					),
				];
		} catch {}
		return [];
	})(),
];
let evaluatorRunnerPath = null;
for (const c of candidates) {
	syslog(projectRoot, `candidate: ${c} — ${existsSync(c) ? "found" : "missing"}`);
	if (existsSync(c)) {
		evaluatorRunnerPath = c;
		break;
	}
}
syslog(projectRoot, `evaluatorRunnerPath: ${evaluatorRunnerPath ?? "NOT FOUND"}`);

if (!evaluatorRunnerPath) {
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
			"Could not find @infinitedusky/indusk-mcp package — eval evaluator not available. Run: npm i -g @infinitedusky/indusk-mcp",
	});
	appendFileSync(logPath, `${entry}\n`, "utf8");
	process.exit(0);
}

// Surface unresolved findings from previous evals
const findingsPath = evaluatorRunnerPath.replace("evaluator-runner.js", "findings.js");
if (existsSync(findingsPath)) {
	try {
		const { getUnresolvedFindings } = await import(findingsPath);
		const unresolved = getUnresolvedFindings(projectRoot);
		if (unresolved.length > 0) {
			const lines = unresolved.map(
				(f) => `  [${f.severity}] ${f.questionId}: ${f.finding} (change ${f.changeId.slice(0, 8)})`,
			);
			process.stderr.write(
				`\n📊 Unresolved eval findings (${unresolved.length}):\n${lines.join("\n")}\nUse \`indusk eval fix <key>\` or \`indusk eval ignore <key>\` to resolve.\n\n`,
			);
		}
	} catch {
		// findings module not available — skip silently
	}
}

// Use persistent evaluator — resumes existing session if available, otherwise does full catchup.
const persistentEvaluatorPath = evaluatorRunnerPath.replace(
	"evaluator-runner.js",
	"persistent-evaluator.js",
);
const useModule = existsSync(persistentEvaluatorPath)
	? persistentEvaluatorPath
	: evaluatorRunnerPath;
const useFunction = existsSync(persistentEvaluatorPath) ? "runPersistentEval" : "runEvaluatorSync";

syslog(
	projectRoot,
	`spawning evaluator — module: ${useModule}, function: ${useFunction}, changeId: ${changeId}`,
);

const syslogPath = resolve(projectRoot, ".indusk", "eval", "system.log");
// NOTE: this inline script runs with --input-type=module (see spawn below).
// ESM scope — use static imports from node: specifiers only. CJS module
// resolution throws ReferenceError in ESM scope at parse, and stdio:"ignore"
// on the detached spawn would swallow the error. For the full history see
// .indusk/planning/archive/bug-fix-eval-agent/diagnosis.md
const evaluatorScript = `
import { mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
function syslog(msg) {
  try {
    mkdirSync(dirname("${syslogPath}"), { recursive: true });
    appendFileSync("${syslogPath}", new Date().toISOString() + " " + msg + "\\n");
  } catch {}
}
// Belt-and-suspenders: if the evaluator crashes with an unhandled exception
// or rejection, write a loud error entry to results.log before exit so the
// failure is never silent again.
function writeErrorResult(message) {
  try {
    const logPath = join(${JSON.stringify(projectRoot)}, ".indusk", "eval", "results.log");
    mkdirSync(dirname(logPath), { recursive: true });
    const entry = JSON.stringify({
      version: 1,
      timestamp: new Date().toISOString(),
      mode: "eval",
      changeId: ${JSON.stringify(changeId)},
      error: true,
      message,
    });
    appendFileSync(logPath, entry + "\\n", "utf8");
  } catch {}
}
process.on("uncaughtException", (err) => {
  syslog("evaluator uncaughtException — " + (err && err.message ? err.message : String(err)));
  writeErrorResult("uncaughtException: " + (err && err.message ? err.message : String(err)));
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  syslog("evaluator unhandledRejection — " + (reason && reason.message ? reason.message : String(reason)));
  writeErrorResult("unhandledRejection: " + (reason && reason.message ? reason.message : String(reason)));
  process.exit(1);
});
syslog("evaluator process started — changeId: ${changeId}");
import("${useModule}")
  .then(m => {
    syslog("evaluator module loaded — calling ${useFunction}");
    return m.${useFunction}({
      projectRoot: ${JSON.stringify(projectRoot)},
      changeId: ${JSON.stringify(changeId)},
      transcriptPath: ${JSON.stringify(transcriptPath)},
      mode: "eval",
      evalEndpoint: ${JSON.stringify(evalConfig.endpoint)},
    });
  })
  .then((result) => {
    const hasError = result && result.error;
    syslog("evaluator completed — " + (hasError ? "error: " + result.message : "scorecard written"));
    process.exit(0);
  })
  .catch(err => {
    syslog("evaluator crashed — " + (err.message || String(err)));
    writeErrorResult(err.message || String(err));
    process.exit(1);
  });
`;

const child = spawn("node", ["--input-type=module", "-e", evaluatorScript], {
	cwd: projectRoot,
	stdio: "ignore",
	detached: true,
	env: { ...process.env, INDUSK_EVAL_SOURCE: source },
});

child.unref();

syslog(projectRoot, `evaluator spawned — source: ${source}, pid: ${child.pid}`);

if (cliSource !== null) {
	// CLI mode — write a brief notice to stderr and exit
	process.stderr.write(
		`📊 Eval evaluator spawned (source=${source}) for ${changeId.slice(0, 8)}. Results will appear in .indusk/eval/results.log\n`,
	);
} else {
	// Hook mode — output structured hook response
	const output = JSON.stringify({
		hookSpecificOutput: {
			hookEventName: "PostToolUse",
			message: `Eval evaluator spawned for change ${changeId.slice(0, 8)}`,
		},
	});
	process.stdout.write(output);
	process.stderr.write(
		`📊 Eval evaluator spawned in background for ${changeId.slice(0, 8)}. Results will appear in .indusk/eval/results.log\n`,
	);
}

process.exit(0);
