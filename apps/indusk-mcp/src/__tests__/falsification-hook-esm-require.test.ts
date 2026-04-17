import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Falsification test for `improvement-eval-agent-open-telemetry`.
 *
 * Hypothesis: The hook at `apps/indusk-mcp/hooks/eval-trigger.js` spawns a
 * detached child with `node --input-type=module -e <inline-script>`. The
 * inline script's first two statements use CJS `require("fs")` and
 * `require("path")`. `require` is not defined in ESM scope — the process
 * crashes with `ReferenceError` at parse/init, before `import(evaluator-runner)`
 * is ever reached. `stdio: "ignore"` swallows the crash.
 *
 * Observable consequence: every hook-spawned evaluator since the rename/OTel
 * work has been silently failing. Scorecards in `.indusk/eval/results.log`
 * after 2026-04-11 all came from manual direct invocations, not from
 * `jj describe` triggers. The OTel plan's Deferred Verification mitigation
 * ("run jj describe and confirm a trace appears in Dash0") was therefore
 * unmet — we verified via direct-invocation smoke, not the hook path.
 *
 * This test asserts the failure mode exists today. It is expected to FAIL
 * on the pre-fix code (proving the bug) and PASS after either (a) the hook
 * script switches to ESM-native `import`/`createRequire`, or (b) the spawn
 * switches to CJS mode. Either way, this test is the bounty.
 */

let sandbox: string;

beforeEach(() => {
	sandbox = mkdtempSync(join(tmpdir(), "falsify-hook-esm-"));
});

afterEach(() => {
	rmSync(sandbox, { recursive: true, force: true });
});

// Regression suite (formerly the falsification bounty for
// `improvement-eval-agent-open-telemetry`). `bug-fix-eval-agent` Phase 2
// fixed the hook's inline script to use ESM-native imports. This suite now
// guards against regression — if someone reintroduces `require()` in the
// spawned-subprocess context, the third assertion fails and the build
// breaks.
describe("regression: hook's embedded evaluatorScript must use ESM-native imports (no require)", () => {
	it("reproduces the failure mode — a minimal script with the same shape as the hook crashes at line 1", () => {
		// Mirrors the hook's exact pattern (apps/indusk-mcp/hooks/eval-trigger.js, the
		// `evaluatorScript` template literal starting ~line 229).
		const script = `
const fs = require("fs");
const path = require("path");
function syslog(msg) {
  try {
    fs.mkdirSync("${sandbox}", { recursive: true });
    fs.appendFileSync("${sandbox}/log", new Date().toISOString() + " " + msg + "\\n");
  } catch {}
}
syslog("evaluator process started");
`;

		let crashed = false;
		let stderr = "";
		try {
			execFileSync(process.execPath, ["--input-type=module", "-e", script], {
				stdio: ["ignore", "pipe", "pipe"],
				timeout: 5000,
			});
		} catch (err) {
			crashed = true;
			stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? "";
		}

		// The hypothesis: the process crashes with a ReferenceError on `require`.
		expect(crashed).toBe(true);
		expect(stderr).toMatch(/ReferenceError: require is not defined in ES module scope/);
	});

	it("silent-failure path: syslog never writes its first line (sandbox/log is never created)", () => {
		const script = `
const fs = require("fs");
const path = require("path");
function syslog(msg) {
  try {
    fs.mkdirSync("${sandbox}", { recursive: true });
    fs.appendFileSync("${sandbox}/log", new Date().toISOString() + " " + msg + "\\n");
  } catch {}
}
syslog("evaluator process started");
`;
		// Intentionally swallow the ReferenceError stderr — mirror the hook's stdio: "ignore"
		try {
			execFileSync(process.execPath, ["--input-type=module", "-e", script], {
				stdio: ["ignore", "ignore", "ignore"],
				timeout: 5000,
			});
		} catch {
			// Expected — script crashes
		}

		// The first `syslog()` call in the hook's inline script is the
		// "evaluator process started" line. If `require` crashes the process,
		// that line never runs, so the log file never exists.
		expect(existsSync(`${sandbox}/log`)).toBe(false);
	});

	it("confirms the hook's own file has the pattern — DASH0/sandbox-neutral grep against the real source", () => {
		// Direct evidence from the real hook file: if the hook still has the
		// require() calls, this test flags it as an outstanding bug.
		const hookPath = join(__dirname, "../../hooks/eval-trigger.js");
		const hookBody = readFileSync(hookPath, "utf-8");

		// Check for CJS `require()` calls targeting fs / path in any shape:
		// - double quotes: require("fs")
		// - single quotes: require('fs')
		// - backticks: require(`fs`)
		// - whitespace around the parens/quotes
		// - with or without `node:` prefix
		// Broadened after the falsification bounty at
		// `falsification-regression-regex-coverage.test.ts` showed the original
		// double-quote-only regex let 6 semantic-equivalent variants slip through.
		const cjsRequireFs = /require\s*\(\s*['"`](?:node:)?fs['"`]\s*\)/;
		const cjsRequirePath = /require\s*\(\s*['"`](?:node:)?path['"`]\s*\)/;

		// The test fails while the bug exists. Once the hook uses ESM-native
		// imports (or switches to CJS spawn mode), the test passes.
		expect(cjsRequireFs.test(hookBody)).toBe(false);
		expect(cjsRequirePath.test(hookBody)).toBe(false);
	});
});
