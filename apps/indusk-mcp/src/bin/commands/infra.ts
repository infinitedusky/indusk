import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONTAINER_NAME = "indusk-infra";
const IMAGE_NAME = "indusk-infra";
const VOLUME_NAME = "indusk-data";
const CONFIG_DIR = join(homedir(), ".indusk");
const CONFIG_FILE = join(CONFIG_DIR, "config.env");

function run(cmd: string, timeout = 10000): string {
	try {
		return execSync(cmd, {
			encoding: "utf-8",
			timeout,
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch {
		return "";
	}
}

function loadConfig(): Record<string, string> {
	const config: Record<string, string> = {};
	if (!existsSync(CONFIG_FILE)) return config;
	const content = readFileSync(CONFIG_FILE, "utf-8");
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		config[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
	}
	return config;
}

function ensureConfig(): Record<string, string> {
	if (!existsSync(CONFIG_DIR)) {
		mkdirSync(CONFIG_DIR, { recursive: true });
	}
	if (!existsSync(CONFIG_FILE)) {
		writeFileSync(
			CONFIG_FILE,
			[
				"# InDusk global configuration",
				"# This file is read by `indusk infra start` to configure the infrastructure container.",
				"",
				"# Required for Graphiti (Gemini LLM/embeddings). Get from https://aistudio.google.com/apikey",
				"GOOGLE_API_KEY=",
				"",
				"# Optional: OTel export endpoint (e.g., https://api.region.gcp.dash0.com)",
				"# OTEL_EXPORTER_OTLP_ENDPOINT=",
				"# OTEL_EXPORTER_OTLP_HEADERS=",
				"# OTEL_SERVICE_NAME=indusk-infra",
				"",
			].join("\n"),
		);
		console.info(`Created ${CONFIG_FILE}`);
		console.info("");
		console.info("Add your GOOGLE_API_KEY to this file:");
		console.info(`  ${CONFIG_FILE}`);
		console.info("");
		console.info("Get a key from: https://aistudio.google.com/apikey");
		console.info("Without it, FalkorDB works but Graphiti will not (graceful degradation).");
	}
	return loadConfig();
}

function getContainerStatus(): "running" | "stopped" | "missing" {
	const running = run(`docker ps --filter name=^${CONTAINER_NAME}$ --format '{{.Status}}'`);
	if (running) return "running";

	const exists = run(`docker ps -a --filter name=^${CONTAINER_NAME}$ --format '{{.Status}}'`);
	if (exists) return "stopped";

	return "missing";
}

export async function infraStart(): Promise<void> {
	const status = getContainerStatus();

	if (status === "running") {
		console.info(`${CONTAINER_NAME} is already running.`);
		await infraStatus();
		return;
	}

	if (status === "stopped") {
		console.info(`Starting ${CONTAINER_NAME}...`);
		const result = run(`docker start ${CONTAINER_NAME}`);
		if (result) {
			console.info("Started.");
			// Wait for FalkorDB to be ready
			await waitForReady();
			await infraStatus();
		} else {
			console.error(`Failed to start ${CONTAINER_NAME}.`);
			process.exitCode = 1;
		}
		return;
	}

	// Container doesn't exist — check for image, then create
	const hasImage = run(`docker images -q ${IMAGE_NAME}`);
	if (!hasImage) {
		console.error(`Docker image '${IMAGE_NAME}' not found.`);
		console.error("");
		console.error("Build it from the infinitedusky repo:");
		console.error("  docker build -f docker/Dockerfile.infra -t indusk-infra .");
		console.error("");
		console.error("Or pull from GHCR (when published):");
		console.error("  docker pull ghcr.io/infinitedusky/indusk-infra:latest");
		process.exitCode = 1;
		return;
	}

	// Load config for env vars
	const config = ensureConfig();
	const envArgs: string[] = [];

	if (config.GOOGLE_API_KEY) {
		envArgs.push(`-e GOOGLE_API_KEY=${config.GOOGLE_API_KEY}`);
	} else {
		console.warn(
			"Warning: GOOGLE_API_KEY not set in ~/.indusk/config.env — Graphiti will not work.",
		);
	}

	if (config.OTEL_EXPORTER_OTLP_ENDPOINT) {
		envArgs.push(`-e OTEL_EXPORTER_OTLP_ENDPOINT=${config.OTEL_EXPORTER_OTLP_ENDPOINT}`);
	}
	if (config.OTEL_EXPORTER_OTLP_HEADERS) {
		envArgs.push(`-e OTEL_EXPORTER_OTLP_HEADERS=${config.OTEL_EXPORTER_OTLP_HEADERS}`);
	}
	if (config.OTEL_SERVICE_NAME) {
		envArgs.push(`-e OTEL_SERVICE_NAME=${config.OTEL_SERVICE_NAME}`);
	}

	console.info(`Creating ${CONTAINER_NAME}...`);
	const createCmd = [
		"docker run -d",
		`--name ${CONTAINER_NAME}`,
		"-p 6379:6379",
		"-p 8100:8100",
		`-v ${VOLUME_NAME}:/data`,
		"--restart unless-stopped",
		...envArgs,
		IMAGE_NAME,
	].join(" ");

	const result = run(createCmd, 30000);
	if (result) {
		console.info("Created.");
		await waitForReady();
		await infraStatus();
	} else {
		console.error("Failed to create container.");
		console.error(`Command: ${createCmd}`);
		process.exitCode = 1;
	}
}

export async function infraStop(): Promise<void> {
	const status = getContainerStatus();

	if (status === "missing") {
		console.info(`${CONTAINER_NAME} does not exist.`);
		return;
	}

	if (status === "stopped") {
		console.info(`${CONTAINER_NAME} is already stopped.`);
		return;
	}

	console.info(`Stopping ${CONTAINER_NAME}...`);
	const result = run(`docker stop ${CONTAINER_NAME}`, 30000);
	if (result) {
		console.info("Stopped. Data preserved in volume.");
	} else {
		console.error("Failed to stop container.");
		process.exitCode = 1;
	}
}

export async function infraStatus(): Promise<void> {
	const status = getContainerStatus();

	console.info(`Container: ${CONTAINER_NAME}`);
	console.info(`Status:    ${status}`);

	if (status !== "running") {
		if (status === "stopped") {
			console.info("\nRun `indusk infra start` to start.");
		} else {
			console.info("\nRun `indusk infra start` to create and start.");
		}
		return;
	}

	// FalkorDB health
	const pong = run("redis-cli -h localhost ping");
	console.info(`FalkorDB:  ${pong === "PONG" ? "healthy" : "unreachable"}`);

	// Graph count
	if (pong === "PONG") {
		const graphs = run("redis-cli -h localhost GRAPH.LIST");
		const graphList = graphs ? graphs.split("\n").filter((l) => l.trim()) : [];
		console.info(`Graphs:    ${graphList.length} (${graphList.join(", ")})`);
	}

	// Graphiti health
	try {
		const health = run("curl -sf http://localhost:8100/health", 5000);
		if (health) {
			console.info("Graphiti:  healthy");
		} else {
			console.info("Graphiti:  starting or unreachable");
		}
	} catch {
		console.info("Graphiti:  unreachable");
	}

	// Config
	const config = loadConfig();
	console.info(`API Key:   ${config.GOOGLE_API_KEY ? "configured" : "not set"}`);
	console.info(`OTel:      ${config.OTEL_EXPORTER_OTLP_ENDPOINT ? "enabled" : "disabled"}`);
}

async function waitForReady(): Promise<void> {
	console.info("Waiting for FalkorDB...");
	for (let i = 0; i < 10; i++) {
		const pong = run("redis-cli -h localhost ping");
		if (pong === "PONG") {
			console.info("FalkorDB ready.");
			return;
		}
		await new Promise((r) => setTimeout(r, 2000));
	}
	console.warn("FalkorDB did not respond within 20s — may still be loading.");
}
