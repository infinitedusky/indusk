import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { daemonAddress } from "./telemetry/daemon-address.js";
import { induskHome } from "./telemetry/status.js";

/**
 * A project's `.mcp.json` — the per-machine list of MCP servers Claude Code
 * connects to. It is not versioned (untrack-mcp-json): `.gitignore` carries it,
 * `ensureMcpJson` writes one when a checkout has none, and registering a project
 * writes its own `jaeger` entry, only when it differs.
 */
export interface McpServerEntry {
	type?: string;
	url?: string;
	command?: string;
	args?: string[];
	[k: string]: unknown;
}

export interface McpJson {
	mcpServers?: Record<string, McpServerEntry>;
}

const MCP_JSON = ".mcp.json";

export function readMcpJson(projectPath: string): McpJson {
	const p = join(projectPath, MCP_JSON);
	if (!existsSync(p)) return { mcpServers: {} };
	try {
		return JSON.parse(readFileSync(p, "utf-8")) as McpJson;
	} catch {
		return { mcpServers: {} };
	}
}

export function writeMcpJson(projectPath: string, data: McpJson): void {
	writeFileSync(join(projectPath, MCP_JSON), `${JSON.stringify(data, null, 2)}\n`);
}

/** Whether an `indusk` binary is on the PATH: the installed form of the server, else `npx`. */
function hasGlobalIndusk(): boolean {
	const probe = spawnSync(process.platform === "win32" ? "where" : "which", ["indusk"], {
		stdio: "ignore",
	});
	return probe.status === 0;
}

// promise: a-clone-without-an-mcp-config-gets-the-keep-list
/** Whether the project has the telemetry extension enabled: its manifest is shipped on enable. */
function hasTelemetryExtension(projectPath: string): boolean {
	return existsSync(join(projectPath, ".indusk", "extensions", "local-telemetry", "manifest.json"));
}

/**
 * Write a `.mcp.json` naming the `indusk` server when a checkout has none, and
 * the `jaeger` server too when the telemetry extension is enabled and the
 * daemon's address is stored. A file that exists is never read, merged or
 * rewritten: it is the person's.
 * `globalBinary` mirrors `init`: the installed `indusk`, else `npx`; left out, it is
 * looked up on the PATH.
 */
export function ensureMcpJson(
	projectPath: string,
	opts: { globalBinary?: boolean } = {},
): "created" | "present" {
	if (existsSync(join(projectPath, MCP_JSON))) return "present";
	const globalBinary = opts.globalBinary ?? hasGlobalIndusk();
	const indusk: McpServerEntry = globalBinary
		? { type: "stdio", command: "indusk", args: ["serve"], env: { PROJECT_ROOT: "." } }
		: {
				type: "stdio",
				command: "npx",
				args: ["--yes", "@infinitedusky/indusk-mcp", "serve"],
				env: { PROJECT_ROOT: "." },
			};
	const mcpServers: Record<string, McpServerEntry> = { indusk };
	const address = hasTelemetryExtension(projectPath) ? daemonAddress(induskHome()) : null;
	if (address !== null) mcpServers.jaeger = { type: "http", url: address.mcp };
	writeMcpJson(projectPath, { mcpServers });
	return "created";
}

/**
 * Give a new checkout of a project (a plan worktree) its own `.mcp.json`: a copy of
 * the source checkout's when it has one, else the default. Git no longer carries the
 * file, so a worktree has none until this runs. Never overwrites one that exists.
 */
export function provisionMcpJson(fromProject: string, toProject: string): void {
	const target = join(toProject, MCP_JSON);
	if (existsSync(target)) return;
	const source = join(fromProject, MCP_JSON);
	if (existsSync(source)) copyFileSync(source, target);
	else ensureMcpJson(toProject);
}

/** The `jaeger` entry a project should have for the daemon's MCP port, or `null` when its entry already is that. */
export function jaegerEntryChange(
	current: McpServerEntry | null | undefined,
	mcpPort: number,
): McpServerEntry | null {
	const wanted = { type: "http", url: `http://localhost:${mcpPort}/mcp` };
	return current?.type === wanted.type && current.url === wanted.url ? null : wanted;
}

/** Point the project's `jaeger` entry at the daemon's MCP port, writing the file only on a change. Whether it wrote. */
export function upsertJaegerEntry(projectPath: string, mcpPort: number): boolean {
	ensureMcpJson(projectPath);
	const data = readMcpJson(projectPath);
	const change = jaegerEntryChange(data.mcpServers?.jaeger, mcpPort);
	if (change === null) return false;
	data.mcpServers = { ...data.mcpServers, jaeger: change };
	writeMcpJson(projectPath, data);
	return true;
}

export function removeJaegerEntry(projectPath: string): void {
	if (!existsSync(join(projectPath, MCP_JSON))) return;
	const data = readMcpJson(projectPath);
	if (data.mcpServers?.jaeger) {
		delete data.mcpServers.jaeger;
		writeMcpJson(projectPath, data);
	}
}
