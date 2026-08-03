#!/usr/bin/env node

/**
 * Eval trigger. git-only as of 1.31.0 (`git-only-substrate` Phase 2).
 *
 * 1) PostToolUse hook mode (default): fires on Bash tool calls containing
 *    `git commit`. Reads the hook event JSON from stdin. Spawns the
 *    evaluator runner as a detached background process.
 *
 * 2) CLI mode (`--source <tag>`): invoked manually by skills (e.g., handoff)
 *    at session end. No stdin read, no trigger-command filter. Uses the
 *    current commit ID and passes the source tag to the evaluator
 *    via INDUSK_EVAL_SOURCE. The evaluator may skip diff-based scoring when
 *    source != "commit" but still processes the highlights queue.
 *
 * 3) Drain mode (`--drain-pending`, dawn-hook-parity): evaluates every
 *    not-yet-drained record the thin lane queued in
 *    `.indusk/eval/pending.jsonl`, exactly once each. The drained ledger
 *    (`pending-drained.jsonl`) is written BEFORE each spawn — a crashed
 *    spawn is a logged gap, never a double-eval (the markProcessed
 *    invariant). Each record re-invokes this script in CLI mode with
 *    `--change-id <sha>`; `INDUSK_EVAL_CMD` overrides the per-record
 *    command for tests (receives `<sha> <source>` as argv).
 *
 * Commit ID extraction: `git rev-parse --short HEAD`, or `--change-id <sha>`
 * when given (drain mode's per-record invocations).
 *
 * Exit 0 always — this is advisory, not blocking.
 */

import { execSync, spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveStateAndGitPaths } from "./_hook-paths.js";

// System log — writes to .indusk/eval/system.log under the InDusk state path.
// In workbench mode this lands at the workbench root (where .indusk/ lives),
// NOT at the wrapped repo's path. See `_hook-paths.js` for the rationale.
function syslog(statePath, msg) {
	try {
		const logDir = resolve(statePath || ".", ".indusk", "eval");
		mkdirSync(logDir, { recursive: true });
		appendFileSync(resolve(logDir, "system.log"), `${new Date().toISOString()} ${msg}\n`);
	} catch {
		// ignore — logging should never break the hook
	}
}

// Parse a `--flag value` pair from argv. Returns null when absent.
function parseArgValue(argv, flag) {
	const idx = argv.indexOf(flag);
	if (idx === -1 || idx === argv.length - 1) return null;
	const value = argv[idx + 1];
	if (!value || value.startsWith("--")) return null;
	return value;
}

const cliSource = parseArgValue(process.argv, "--source");
const changeIdArg = parseArgValue(process.argv, "--change-id");
const drainPending = process.argv.includes("--drain-pending");
let cwd;
let command = "";
let exitCode = 0;

if (cliSource !== null || drainPending) {
	// CLI/drain mode — no stdin, no git commit filter
	cwd = process.cwd();
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
	exitCode = event.tool_response?.exit_code ?? 0;
}

// Workbench-aware path resolution (1.31.7). statePath is where `.indusk/`
// lives — for state operations (config, system.log, results.log, highlights).
// gitPath is the git repo root — for git operations (rev-parse HEAD, etc.).
// In single-repo mode they're the same; in workbench mode statePath is the
// workbench root and gitPath is the wrapped repo (or worktree).
//
// Resolve EARLY (before any syslog) so every subsequent log line writes
// under the InDusk state path, not the wrapped-repo cwd. Pre-1.31.7, the
// early syslog calls used raw `cwd` and silently created stray `.indusk/`
// directories inside wrapped repos — exactly the "no lingering app-level
// state" pattern this plan is fixing.
const { statePath: resolvedStatePath, gitPath } = resolveStateAndGitPaths(cwd);
const statePath = resolvedStatePath ?? cwd;

if (cliSource !== null || drainPending) {
	syslog(statePath, drainPending ? "drain invocation (--drain-pending)" : `cli invocation — source: ${cliSource}`);
} else {
	syslog(statePath, `hook fired — tool: Bash, command: ${command.slice(0, 100)}`);

	// Fast path: skip failed bash commands. PostToolUse hooks fire regardless
	// of the underlying command's exit code, so a `git commit` that fails
	// (no staged changes, pre-commit hook rejection, signing failure) would
	// otherwise trigger an eval against the PREVIOUS commit's SHA — producing
	// a misleading scorecard for stale state. Read tool_response.exit_code
	// (Claude Code's hook event shape) and skip when non-zero. Treats missing
	// exit_code as 0 (success) — preserves prior behavior on hook events that
	// don't carry the field.
	if (exitCode !== 0) {
		syslog(statePath, `skip — bash command failed (exit_code=${exitCode})`);
		process.exit(0);
	}

	// Fast path: not a recognized commit-trigger command. The hook fires on
	// the user-facing porcelain `git commit ...` but NOT on git plumbing
	// commands like `git commit-tree` or `git commit-graph`. The left-edge
	// `\b` defends substring false-positives ("git committer" — `committer`
	// has `commit` as a substring); the right-edge requires the next
	// character to terminate the command word (whitespace, end-of-string,
	// or a shell separator). Without the right-edge tightening, JS's `\b`
	// matches `t`→`-` (word char to non-word), which would let
	// `git commit-tree` fire the hook.
	const TRIGGER_RE = /\bgit commit(?=$|\s|;|&|\|)/;
	if (!TRIGGER_RE.test(command)) {
		syslog(statePath, "skip — no git commit in command");
		process.exit(0);
	}
}

const source = cliSource ?? "commit";

/**
 * Read eval config from .indusk/config.json.
 */
function readEvalConfig(statePath) {
	const configPath = `${statePath}/.indusk/config.json`;
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

// statePath + gitPath were resolved earlier (above) before any syslog
// calls — see the workbench-aware path resolution block.
const evalConfig = readEvalConfig(statePath);

syslog(
	statePath,
	`statePath: ${statePath}, gitPath: ${gitPath ?? "(none)"}, eval.enabled: ${evalConfig.enabled}`,
);

// Check if eval is disabled
if (!evalConfig.enabled) {
	syslog(statePath, "skip — eval disabled in config");
	process.exit(0);
}

// ---------------------------------------------------------------------------
// Drain mode (dawn-hook-parity): evaluate the thin lane's queued commits,
// exactly once each. Ledger-before-spawn: a crashed spawn is a logged gap,
// never a double-eval. Sequential and awaited — a drain is a foreground
// maintenance command (rail-check), and awaiting serializes evaluator
// pressure. NOTE (recorded limitation): the real per-record child detaches
// its inner evaluator, so a large backlog still fans out; keep drains at
// rail-check cadence rather than letting the queue grow unbounded.
// ---------------------------------------------------------------------------
if (drainPending) {
	const evalDir = resolve(statePath, ".indusk", "eval");
	const readJsonl = (path) => {
		if (!existsSync(path)) return [];
		return readFileSync(path, "utf8")
			.split("\n")
			.filter((line) => line.trim())
			.flatMap((line) => {
				try {
					return [JSON.parse(line)];
				} catch {
					return []; // partial lines from crashed writers — skip, never fatal
				}
			});
	};
	const pending = readJsonl(resolve(evalDir, "pending.jsonl"));
	const drainedShas = new Set(readJsonl(resolve(evalDir, "pending-drained.jsonl")).map((r) => r.sha));
	const todo = pending.filter((r) => typeof r.sha === "string" && !drainedShas.has(r.sha));

	const runOne = (record) =>
		new Promise((resolveRun) => {
			const recordSource = record.source ?? "atdawn";
			const override = process.env.INDUSK_EVAL_CMD;
			const [cmd, ...baseArgs] = override
				? override.split(" ").filter(Boolean)
				: [process.execPath, "--no-warnings", fileURLToPath(import.meta.url), "--source", recordSource, "--change-id", record.sha];
			const args = override ? [...baseArgs, record.sha, recordSource] : baseArgs;
			const child = spawn(cmd, args, { cwd, stdio: ["ignore", "ignore", "inherit"] });
			child.on("close", () => resolveRun());
			child.on("error", () => resolveRun());
		});

	let drainedCount = 0;
	for (const record of todo) {
		mkdirSync(evalDir, { recursive: true });
		appendFileSync(
			resolve(evalDir, "pending-drained.jsonl"),
			`${JSON.stringify({ sha: record.sha, drainedAt: new Date().toISOString() })}\n`,
			"utf8",
		);
		await runOne(record);
		drainedCount++;
	}
	syslog(statePath, `drain complete — ${drainedCount} drained, ${pending.length - todo.length} already drained`);
	process.stderr.write(
		`📊 Drained ${drainedCount} pending eval(s); ${pending.length - todo.length} already drained. Results land in .indusk/eval/results.log\n`,
	);
	process.exit(0);
}

// Get the current commit ID. Runs against gitPath, not statePath — in
// workbench mode the two differ (statePath = workbench root, NOT a git repo;
// gitPath = wrapped repo or worktree). Pre-1.31.7 ran against statePath
// and bailed on every commit in workbench-shaped projects.
let changeId = changeIdArg ?? undefined;
if (!changeId && gitPath) {
	try {
		changeId = execSync("git rev-parse --short HEAD", {
			cwd: gitPath,
			encoding: "utf8",
			timeout: 5000,
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		// git failed — skip eval silently. No commit ID means we have
		// nothing meaningful to evaluate against.
	}
}
if (!changeId) {
	syslog(
		statePath,
		gitPath
			? "skip — no git commit ID available"
			: `skip — no git repo at cwd (workbench-mode state path: ${statePath})`,
	);
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
	// pnpm global root — pnpm's bin shim is a shell script, not a symlink, so
	// realpath/which can't walk to the package. Ask pnpm directly.
	...(() => {
		try {
			const pnpmRoot = execSync("pnpm root -g", { encoding: "utf8" }).trim();
			if (pnpmRoot)
				return [resolve(pnpmRoot, "@infinitedusky/indusk-mcp/dist/lib/eval/evaluator-runner.js")];
		} catch {}
		return [];
	})(),
	// npm global root — explicit `npm root -g` covers cases where the indusk
	// bin's parent layout doesn't match `<bin>/../lib/node_modules/...`
	// (e.g., mise-managed Node installs, custom prefixes).
	...(() => {
		try {
			const npmRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
			if (npmRoot)
				return [resolve(npmRoot, "@infinitedusky/indusk-mcp/dist/lib/eval/evaluator-runner.js")];
		} catch {}
		return [];
	})(),
];
let evaluatorRunnerPath = null;
for (const c of candidates) {
	syslog(statePath, `candidate: ${c} — ${existsSync(c) ? "found" : "missing"}`);
	if (existsSync(c)) {
		evaluatorRunnerPath = c;
		break;
	}
}
syslog(statePath, `evaluatorRunnerPath: ${evaluatorRunnerPath ?? "NOT FOUND"}`);

if (!evaluatorRunnerPath) {
	// Can't find the package — log error and exit
	const { mkdirSync, appendFileSync } = await import("node:fs");
	const logPath = resolve(statePath, ".indusk", "eval", "results.log");
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
		const unresolved = getUnresolvedFindings(statePath);
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
	statePath,
	`spawning evaluator — module: ${useModule}, function: ${useFunction}, changeId: ${changeId}`,
);

const syslogPath = resolve(statePath, ".indusk", "eval", "system.log");
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
    const logPath = join(${JSON.stringify(statePath)}, ".indusk", "eval", "results.log");
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
    // CONTRACT: the state root MUST be passed as \`projectRoot\` (the key both
    // runPersistentEval and runEvaluatorSync read). 1.31.7 renamed this to
    // \`statePath\` here without updating the evaluator signatures, so
    // opts.projectRoot was undefined and the evaluator crashed at
    // initEvalOtel(undefined) → join(undefined,…) before any work — silently
    // killing the eval→Graphiti rail. \`gitRoot\` carries the git repo so the
    // inner claude's \`git show \${changeId}\` resolves in workbench mode (state
    // root is the non-git workbench root). Guarded by
    // eval-trigger-evaluator-arg-contract.test.ts.
    return m.${useFunction}({
      projectRoot: ${JSON.stringify(statePath)},
      gitRoot: ${JSON.stringify(gitPath ?? statePath)},
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

// Spawn cwd: gitPath when available — the inner claude --print process
// inherits this cwd, and the rubric's diff-fetch step issues `git show
// ${changeId}` which needs to run inside the git repo. In single-repo mode
// gitPath === statePath so this is the same as before. In workbench mode
// the runner inherits the wrapped repo's cwd so git ops work; state file
// access uses the absolute `statePath` baked into the inline script.
const child = spawn("node", ["--input-type=module", "-e", evaluatorScript], {
	cwd: gitPath ?? statePath,
	stdio: "ignore",
	detached: true,
	env: { ...process.env, INDUSK_EVAL_SOURCE: source },
});

child.unref();

syslog(statePath, `evaluator spawned — source: ${source}, pid: ${child.pid}`);

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
