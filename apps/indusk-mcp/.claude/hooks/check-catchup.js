#!/usr/bin/env node
/**
 * PreToolUse hook: blocks Edit/Write on project files until /catchup is complete.
 *
 * Reads .claude/handoff.md and checks that all Catchup Status boxes are checked.
 * Allows edits TO the handoff file itself — BUT if the edit is checking off
 * "mcp-ready", the hook verifies MCP servers are actually reachable first.
 * Allows edits if no handoff file exists (first session, no enforcement).
 *
 * Exit 0 = allow
 * Exit 2 = block (stderr sent to agent)
 */

import { execSync } from "node:child_process";
import { createConnection } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
const toolInput = input.tool_input ?? {};
const filePath = toolInput.file_path ?? "";
const newString = toolInput.new_string ?? "";

// Find project root by looking for .claude/ directory
function findProjectRoot() {
	let dir = process.cwd();
	for (let i = 0; i < 10; i++) {
		if (existsSync(join(dir, ".claude"))) return dir;
		const parent = resolve(dir, "..");
		if (parent === dir) break;
		dir = parent;
	}
	return process.cwd();
}

/** TCP check: can we connect to host:port? */
function checkTcp(host, port, timeoutMs = 3000) {
	return new Promise((resolve) => {
		const sock = createConnection({ host, port });
		sock.setTimeout(timeoutMs);
		sock.on("connect", () => { sock.end(); resolve(true); });
		sock.on("error", () => resolve(false));
		sock.on("timeout", () => { sock.destroy(); resolve(false); });
	});
}

const projectRoot = findProjectRoot();
const handoffPath = join(projectRoot, ".claude", "handoff.md");

// Allow if no handoff exists (first session or handoff not yet created)
if (!existsSync(handoffPath)) {
	process.exit(0);
}

// Edits to handoff.md — allowed, but with MCP verification gate
if (filePath.endsWith("handoff.md")) {
	// If the edit is checking off mcp-ready, verify MCP servers are actually up
	if (newString.includes("[x] mcp-ready")) {
		const errors = [];

		// Check FalkorDB (indusk-infra container) on localhost:6379
		const falkorUp = await checkTcp("localhost", 6379);
		if (!falkorUp) {
			errors.push("FalkorDB not reachable on localhost:6379 — is indusk-infra running? Try: docker start indusk-infra");
		}

		// Check Graphiti on localhost:8100
		try {
			const health = execSync("curl -sf http://localhost:8100/health", {
				encoding: "utf-8",
				timeout: 5000,
				stdio: ["ignore", "pipe", "pipe"],
			}).trim();
			if (!health.includes("healthy")) {
				errors.push("Graphiti responded but not healthy on localhost:8100");
			}
		} catch {
			errors.push("Graphiti MCP server not reachable on localhost:8100 — may still be starting (~90s after container restart)");
		}

		if (errors.length > 0) {
			process.stderr.write(
				`Cannot check off mcp-ready — infrastructure verification failed:\n` +
				errors.map((e) => `  - ${e}`).join("\n") + "\n" +
				`Fix the issues above before proceeding with catchup.`,
			);
			process.exit(2);
		}
	}
	process.exit(0);
}

// Read the handoff and check catchup status
const content = readFileSync(handoffPath, "utf-8");

// Look for the Catchup Status section
const statusMatch = content.match(/## Catchup Status\n([\s\S]*?)(?:\n##|\n$|$)/);
if (!statusMatch) {
	// No catchup status section — allow (handoff was written before this feature)
	process.exit(0);
}

const statusSection = statusMatch[1];
const unchecked = [];
const checkboxes = statusSection.matchAll(/- \[( |x)\] (\w+)/g);

for (const match of checkboxes) {
	if (match[1] === " ") {
		unchecked.push(match[2]);
	}
}

if (unchecked.length === 0) {
	// All boxes checked — catchup is complete
	process.exit(0);
}

// Block the edit
process.stderr.write(
	`Catchup incomplete. Run /catchup before editing project files.\n` +
		`Missing steps: ${unchecked.join(", ")}\n` +
		`The handoff file (.claude/handoff.md) has unchecked catchup boxes. ` +
		`Complete each /catchup step to check them off.`,
);
process.exit(2);
