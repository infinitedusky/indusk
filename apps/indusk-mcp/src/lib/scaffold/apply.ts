import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { getProjectGroupId, isExtensionExplicitlyDisabled } from "../config.js";
import { induskMcpPackageRoot } from "../package-root.js";
import { daemonAddress } from "../telemetry/daemon-address.js";
import { induskHome } from "../telemetry/status.js";
import { declaredRepoDirs } from "../worktree/repos.js";
import {
	BESIDE_SUFFIX,
	type PlannedTarget,
	RUNTIME_MARKERS,
	type Runtime,
	scaffoldPlan,
	sha256,
	type TargetRead,
} from "./plan.js";
import { readRecord, writeRecord } from "./record.js";
import { renderTemplate, settingsValues } from "./render.js";

/**
 * The one place a template reaches a project: `init` and `update` both call
 * `applyScaffold`. It reads each target (the declared code repos, else the project root —
 * never a workbench root), asks `scaffoldPlan` what to do, writes, prints a line per file
 * and keeps `.indusk/scaffold.json`.
 *
 * promise: a-new-project-reports-from-its-first-run
 */

export interface ApplyOptions {
	/** init's `--force`: overwrite what is there. */
	force?: boolean;
	/** `--local` mode: the team owns its OpenTelemetry setup. */
	local?: boolean;
}

export interface ApplyResult {
	/** Project-relative paths written for the first time. */
	created: string[];
	skipped?: string;
}

/** The packages `templates/instrumentation.web.ts` imports, as one install argument list. */
const BROWSER_OTEL_PACKAGES = [
	"@opentelemetry/sdk-trace-web",
	"@opentelemetry/sdk-trace-base",
	"@opentelemetry/exporter-trace-otlp-http",
	"@opentelemetry/resources",
	"@opentelemetry/semantic-conventions",
	"@opentelemetry/instrumentation",
	"@opentelemetry/instrumentation-fetch",
	"@opentelemetry/instrumentation-xml-http-request",
	"@opentelemetry/instrumentation-document-load",
	"@opentelemetry/instrumentation-user-interaction",
].join(" ");

const NODE_PACKAGES = [
	"@opentelemetry/api",
	"@opentelemetry/sdk-node",
	"@opentelemetry/auto-instrumentations-node",
	"@opentelemetry/exporter-trace-otlp-http",
	"@opentelemetry/sdk-trace-base",
	"@opentelemetry/resources",
	"@opentelemetry/semantic-conventions",
	"@opentelemetry/core",
	"pino",
	"pino-opentelemetry-transport",
].join(" ");

/** What a browser-instrumented project must set for a click's trace to reach an API on another origin. */
function propagationLines(setting: string): string[] {
	return [
		`cross-origin API: set ${setting} to the API's origin(s), comma-separated (a * entry is a pattern, e.g. https://*.dev.example.com); same-origin requests need nothing`,
		"cross-origin API: the API must allow the traceparent header in its CORS settings (Access-Control-Allow-Headers)",
	];
}

/** What an app that sets up OpenTelemetry itself is told: only the helper (and its settings) were written. */
function ownSetupLines(helper: string): string[] {
	return [
		"this app sets up OpenTelemetry itself: wrote only the signal helper, not a second setup",
		helper.endsWith(".py")
			? "signal: from indusk_signal import signal; signal.upheld(promise) / signal.broken(promise, symptom=...)"
			: "signal: import { signal } from './signal'; signal.upheld({ promise }) / signal.broken({ promise, symptom })",
	];
}

/** The install and wiring lines a runtime's first scaffold prints. `instrumentation` is where its setup file went. */
function guidance(runtime: Runtime, instrumentation: string): string[] {
	switch (runtime) {
		case "node":
			return [
				`install: pnpm add ${NODE_PACKAGES}`,
				`wire: node --import ./${instrumentation} src/index.ts`,
			];
		case "nextjs":
			return [
				`install: pnpm add @vercel/otel @opentelemetry/api pino pino-opentelemetry-transport ${BROWSER_OTEL_PACKAGES}`,
				"wire (server): Next.js loads instrumentation.ts automatically",
				"wire (client): import './instrumentation.web' from a client component (one that starts with \"use client\"), not the root layout",
				...propagationLines("NEXT_PUBLIC_OTEL_PROPAGATE_TO"),
			];
		case "browser":
			return [
				`install: pnpm add ${BROWSER_OTEL_PACKAGES}`,
				"wire: import './instrumentation' at the top of your main.tsx or App.tsx",
				...propagationLines("VITE_OTEL_PROPAGATE_TO"),
			];
		case "python":
			return [
				"install: pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http",
				"wire: import instrumentation as the first import of your entry point, then run it as you do today",
			];
	}
}

const isDir = (path: string) => existsSync(path) && statSync(path).isDirectory();

/** Why this project gets no scaffold, or null. The package's own repository holds the templates as source. */
function skipReason(projectRoot: string, opts: ApplyOptions): string | null {
	if (opts.local) return "local mode (team owns OTel setup)";
	if (
		existsSync(join(projectRoot, "templates/instrumentation.ts")) ||
		existsSync(join(projectRoot, "apps/indusk-mcp/templates/instrumentation.ts"))
	) {
		return "this is the indusk-mcp package (templates are source, not scaffolded)";
	}
	if (isExtensionExplicitlyDisabled(projectRoot, "otel")) {
		return "otel is in disabled_extensions (.indusk/config.json)";
	}
	return null;
}

/** Read one target from disk. */
function readTarget(projectRoot: string, name: string, dir: string): TargetRead {
	return {
		name,
		rel: relative(projectRoot, dir),
		exists: isDir(dir),
		present: (file) => existsSync(join(dir, file)),
		hasSrc: isDir(join(dir, "src")),
		srcApp: isDir(join(dir, "src", "app")) || isDir(join(dir, "src", "pages")),
		current: (path) => {
			const file = join(dir, path);
			return existsSync(file) ? readFileSync(file, "utf-8") : null;
		},
	};
}

const MARKER_NAMES = RUNTIME_MARKERS.flatMap((m) => m.files).join(", ");

/** The install and wiring lines for a target that was just scaffolded for the first time. */
function printFirstScaffoldLines(target: PlannedTarget, runtime: Runtime): void {
	const toTarget = (projectPath: string) =>
		target.rel === "" ? projectPath : relative(target.rel, projectPath);
	const helper = target.files.find((f) => f.role === "helper");
	if (target.ownSetup) {
		if (helper)
			for (const line of ownSetupLines(toTarget(helper.projectPath))) console.info(`  ${line}`);
		return;
	}
	const setup = target.files.find((f) => f.role === "setup");
	for (const line of guidance(runtime, toTarget(setup?.projectPath ?? ""))) {
		console.info(`  ${line}`);
	}
	if (helper) {
		// Only the line saying how to call it: the "wrote only the helper" line is for an app with its own setup.
		for (const line of ownSetupLines(toTarget(helper.projectPath)).slice(1))
			console.info(`  ${line}`);
	}
}

/** Write what the plan says for one target, print a line per change, and update the record. */
function writeTarget(
	projectRoot: string,
	target: PlannedTarget,
	record: Record<string, string>,
	created: string[],
): void {
	const where = target.rel === "" ? "." : target.rel;
	if (target.runtime === "missing") {
		console.info(`  skip: ${target.name} (no checkout at ${where})`);
		return;
	}
	if (target.runtime !== null && target.files.length === 0) {
		console.info(
			`  ${target.name} (${where}) sets up OpenTelemetry itself and has no server to write a signal from: nothing scaffolded`,
		);
		return;
	}
	if (target.runtime === null) {
		console.info(
			`  no app yet: ${target.name} (${where}) — \`indusk update\` scaffolds it once it has one of ${MARKER_NAMES}`,
		);
		return;
	}
	let firstScaffold = false;
	for (const file of target.files) {
		const abs = join(projectRoot, file.projectPath);
		switch (file.action) {
			case "create":
				mkdirSync(dirname(abs), { recursive: true });
				writeFileSync(abs, file.rendered);
				record[file.projectPath] = sha256(file.rendered);
				created.push(file.projectPath);
				firstScaffold = true;
				console.info(`  create: ${file.projectPath} (${file.purpose})`);
				break;
			case "removed":
				console.info(
					`  left out: ${file.projectPath} (you removed it; delete its entry in .indusk/scaffold.json to have it back)`,
				);
				break;
			case "refresh":
				if (!file.current) {
					writeFileSync(abs, file.rendered);
					console.info(`  refresh: ${file.projectPath} (${file.purpose})`);
				}
				record[file.projectPath] = sha256(file.rendered);
				break;
			case "record":
				record[file.projectPath] = sha256(file.rendered);
				break;
			case "beside":
				writeFileSync(`${abs}${BESIDE_SUFFIX}`, file.rendered);
				console.info(
					`  beside: ${file.projectPath}${BESIDE_SUFFIX} (you changed ${file.projectPath}; the newer version is beside it)`,
				);
				break;
		}
	}
	if (firstScaffold) printFirstScaffoldLines(target, target.runtime);
}

/** Scaffold OpenTelemetry into every target of the project, printing an `[OpenTelemetry]` section. */
export function applyScaffold(projectRoot: string, opts: ApplyOptions = {}): ApplyResult {
	console.info("\n[OpenTelemetry]");
	const skipped = skipReason(projectRoot, opts);
	if (skipped !== null) {
		console.info(`  skip: ${skipped}`);
		return { created: [], skipped };
	}

	const declared = declaredRepoDirs(projectRoot);
	const targets = (
		declared.length > 0 ? declared : [{ name: basename(projectRoot), dir: projectRoot }]
	).map(({ name, dir }) => readTarget(projectRoot, name, dir));

	const templates = join(induskMcpPackageRoot(), "templates");
	const project = getProjectGroupId(projectRoot);
	const address = daemonAddress(induskHome());
	const record = readRecord(projectRoot);
	const plan = scaffoldPlan(targets, {
		record: record.files,
		force: opts.force ?? false,
		render: (template, service, where) =>
			renderTemplate(
				template,
				readFileSync(join(templates, template), "utf-8"),
				settingsValues({ service, project, address }),
				where,
			),
	});

	const created: string[] = [];
	for (const target of plan) writeTarget(projectRoot, target, record.files, created);
	if (plan.some((t) => t.files.length > 0)) writeRecord(projectRoot, record);
	return { created };
}
