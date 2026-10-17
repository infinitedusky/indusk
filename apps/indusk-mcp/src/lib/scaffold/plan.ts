import { createHash } from "node:crypto";

/**
 * What the telemetry scaffold writes, where, and what it does with each file — decided
 * from what was read, never by reading (lesson: code-that-decides-takes-its-clock-and-its-reads).
 * `apply.ts` does the reads and the writes; `render.ts` fills the templates.
 *
 * promise: a-new-project-reports-from-its-first-run
 */

export type Runtime = "nextjs" | "browser" | "python" | "node";

/**
 * - `create`: the file is missing and InDusk has no record of writing it (or `force`); write the rendering.
 * - `removed`: the file is missing but InDusk recorded writing it, so a person deleted it; write nothing.
 * - `refresh`: the file is what InDusk recorded writing; write the newer rendering over it.
 * - `record`: the file already is the rendering; record it as InDusk's.
 * - `beside`: the file is not what InDusk recorded (edited, or never InDusk's); leave it and
 *   write the rendering beside it as `<file>.indusk-new`.
 */
export type FileAction = "create" | "removed" | "refresh" | "record" | "beside";

export const BESIDE_SUFFIX = ".indusk-new";

export function sha256(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

/**
 * What to do with one file. Only a file whose content hashes to what InDusk recorded is
 * written over, so a person's edit and a file InDusk never wrote are never lost; a lost
 * record makes every file unrecorded, and an unrecorded file is never overwritten. A recorded
 * file that is gone was deleted by a person and stays deleted.
 * `force` (init's `--force`) overwrites whatever is there and brings back what was deleted.
 */
export function decideFile(f: {
	current: string | null;
	recorded: string | null;
	rendered: string;
	force?: boolean;
}): { action: FileAction } {
	if (f.current === null) return { action: f.recorded !== null && !f.force ? "removed" : "create" };
	if (f.force) return { action: "refresh" };
	if (f.recorded !== null && sha256(f.current) === f.recorded) return { action: "refresh" };
	if (f.current === f.rendered) return { action: "record" };
	return { action: "beside" };
}

/** The files at a target's root that say which runtime it is, in the order they decide. */
export const RUNTIME_MARKERS: { runtime: Runtime; files: string[] }[] = [
	{ runtime: "nextjs", files: ["next.config.js", "next.config.ts", "next.config.mjs"] },
	{ runtime: "browser", files: ["vite.config.ts", "vite.config.js"] },
	{ runtime: "python", files: ["requirements.txt", "pyproject.toml"] },
	{ runtime: "node", files: ["package.json"] },
];

/** The runtime a target's root files say it is, or null when it holds no app yet. */
export function detectRuntime(present: (file: string) => boolean): Runtime | null {
	for (const { runtime, files } of RUNTIME_MARKERS) {
		if (files.some(present)) return runtime;
	}
	return null;
}

/**
 * Why a file is written: `setup` is the OpenTelemetry setup itself, `settings` what the setup
 * and the helper read, `helper` the signal helper an app writes its promise's verdict through.
 */
export type FileRole = "setup" | "settings" | "helper";

/** The packages whose presence in `package.json` means the app sets up OpenTelemetry itself. */
const NODE_OTEL_SETUP = [
	"@opentelemetry/sdk-node",
	"@opentelemetry/sdk-trace-node",
	"@opentelemetry/sdk-trace-web",
	"@vercel/otel",
];

/**
 * Whether the app already sets up OpenTelemetry itself, from its dependency files: a Node,
 * Next.js or browser app by its `package.json` dependencies, a Python app by naming
 * `opentelemetry-sdk` in its requirements or `pyproject.toml`. Unreadable JSON is not a setup.
 */
export function setsUpOpenTelemetry(
	runtime: Runtime,
	read: (path: string) => string | null,
): boolean {
	if (runtime === "python") {
		return ["requirements.txt", "pyproject.toml"].some((f) =>
			/(^|[\s"'])opentelemetry-sdk\b/m.test(read(f) ?? ""),
		);
	}
	try {
		const pkg = JSON.parse(read("package.json") ?? "{}") as Record<string, unknown>;
		const names = ["dependencies", "devDependencies", "peerDependencies"].flatMap((k) =>
			Object.keys((pkg[k] as Record<string, string> | undefined) ?? {}),
		);
		return names.some((n) => NODE_OTEL_SETUP.includes(n));
	} catch {
		return false;
	}
}

export interface ScaffoldFile {
	/** The file under `templates/` it is rendered from. */
	template: string;
	role: FileRole;
	/** Where it goes, relative to the target. */
	path: string;
	/** What it is, in the line printed about it. */
	purpose: string;
}

const SETTINGS = "OpenTelemetry settings — the daemon's address, service, project, environment";
const HELPER = "OpenTelemetry signal helper — upheld and broken, in InDusk's vocabulary";

/**
 * The files a runtime gets. `hasSrc` puts a Node or browser app's files in its `src/`. An app
 * that sets up OpenTelemetry itself (`ownSetup`) gets only the helper and the settings the
 * helper reads — and nothing at all when it has no server to write a signal from. `srcApp`
 * (a Next.js app whose `app/` or `pages/` is in `src/`) moves the Next.js setup file there.
 */
export function filesFor(
	runtime: Runtime,
	hasSrc: boolean,
	ownSetup = false,
	srcApp = false,
): ScaffoldFile[] {
	const all = runtimeFiles(runtime, hasSrc, srcApp);
	if (!ownSetup) return all;
	return all.filter((f) => f.role === "helper" || (f.role === "settings" && hasHelper(all)));
}

const hasHelper = (files: ScaffoldFile[]) => files.some((f) => f.role === "helper");

function runtimeFiles(runtime: Runtime, hasSrc: boolean, srcApp: boolean): ScaffoldFile[] {
	const at = hasSrc ? "src/" : "";
	switch (runtime) {
		case "node":
			return [
				{
					template: "instrumentation.ts",
					path: `${at}instrumentation.ts`,
					purpose: "OpenTelemetry Node SDK",
					role: "setup",
				},
				{
					template: "filtering-exporter.ts",
					path: `${at}filtering-exporter.ts`,
					purpose: "OpenTelemetry span exporter, category filter",
					role: "setup",
				},
				{
					template: "logger.ts",
					path: `${at}logger.ts`,
					purpose: "pino logger — OpenTelemetry log transport",
					role: "setup",
				},
				{
					template: "telemetry-settings.ts",
					path: `${at}telemetry-settings.ts`,
					purpose: SETTINGS,
					role: "settings",
				},
				{ template: "signal.ts", path: `${at}signal.ts`, purpose: HELPER, role: "helper" },
			];
		case "nextjs":
			// Next.js loads `instrumentation.ts` from the folder that holds `app/` or `pages/`:
			// the app root, or `src/` when the pages live there. The rest sit in `src/`.
			return [
				{
					template: "instrumentation.next.ts",
					path: srcApp ? "src/instrumentation.ts" : "instrumentation.ts",
					purpose: "Next.js — @vercel/otel, OpenTelemetry",
					role: "setup",
				},
				{
					template: "logger.ts",
					path: "src/logger.ts",
					purpose: "pino logger — OpenTelemetry log transport",
					role: "setup",
				},
				{
					template: "instrumentation.web.ts",
					path: "src/instrumentation.web.ts",
					purpose: "browser — OTel Web SDK",
					role: "setup",
				},
				{
					template: "telemetry-settings.ts",
					path: "src/telemetry-settings.ts",
					purpose: SETTINGS,
					role: "settings",
				},
				{ template: "signal.ts", path: "src/signal.ts", purpose: HELPER, role: "helper" },
			];
		case "browser":
			return [
				{
					template: "instrumentation.web.ts",
					path: `${at}instrumentation.ts`,
					purpose: "React SPA — OpenTelemetry Web SDK",
					role: "setup",
				},
				{
					template: "telemetry-settings.ts",
					path: `${at}telemetry-settings.ts`,
					purpose: SETTINGS,
					role: "settings",
				},
			];
		case "python":
			return [
				{
					template: "instrumentation.py",
					path: "instrumentation.py",
					purpose: "OpenTelemetry Python SDK",
					role: "setup",
				},
				// Not `signal.py`: a file of that name would hide Python's own `signal` module.
				{
					template: "signal.py",
					path: "indusk_signal.py",
					purpose: HELPER,
					role: "helper",
				},
			];
	}
}

/** What was read from one target: a declared code repo, or the project root. */
export interface TargetRead {
	/** The service name: the code repo's name, else the project folder's. */
	name: string;
	/** The target's directory relative to the project root; "" for the root itself. */
	rel: string;
	/** Whether the directory exists at all. */
	exists: boolean;
	present: (file: string) => boolean;
	hasSrc: boolean;
	/** Whether `src/app` or `src/pages` exists: a Next.js app whose pages live in `src/`. */
	srcApp: boolean;
	/** The content of a file relative to the target, or null when it is missing. */
	current: (path: string) => string | null;
}

export interface ScaffoldReads {
	/** `.indusk/scaffold.json`: project-relative path → hash of what InDusk wrote there. */
	record: Record<string, string>;
	/** A template rendered for one service. */
	render: (template: string, service: string, where: { srcApp: boolean }) => string;
	force: boolean;
}

export interface PlannedFile extends ScaffoldFile {
	/** The path relative to the project root, as printed and recorded. */
	projectPath: string;
	rendered: string;
	action: FileAction;
	/** The file on disk already is the rendering: a refresh writes and says nothing. */
	current: boolean;
}

export interface PlannedTarget {
	name: string;
	rel: string;
	/** "missing" when the directory is not there; null when it holds no app yet. */
	runtime: Runtime | null | "missing";
	/** The app sets up OpenTelemetry itself, so only the helper and its settings are scaffolded. */
	ownSetup: boolean;
	files: PlannedFile[];
}

const joinRel = (rel: string, path: string) => (rel === "" ? path : `${rel}/${path}`);

/** The scaffold for every target: its runtime, and each file with what to do with it. */
export function scaffoldPlan(targets: TargetRead[], reads: ScaffoldReads): PlannedTarget[] {
	return targets.map((t) => {
		if (!t.exists)
			return { name: t.name, rel: t.rel, runtime: "missing", ownSetup: false, files: [] };
		const runtime = detectRuntime(t.present);
		if (runtime === null) return { name: t.name, rel: t.rel, runtime, ownSetup: false, files: [] };
		// A setup InDusk wrote stays InDusk's to refresh, even once its packages are installed.
		const wroteSetup = filesFor(runtime, t.hasSrc, false, t.srcApp).some(
			(f) => f.role === "setup" && joinRel(t.rel, f.path) in reads.record,
		);
		const ownSetup = !wroteSetup && setsUpOpenTelemetry(runtime, t.current);
		const files = filesFor(runtime, t.hasSrc, ownSetup, t.srcApp).map((file) => {
			const projectPath = joinRel(t.rel, file.path);
			const rendered = reads.render(file.template, t.name, { srcApp: t.srcApp });
			const onDisk = t.current(file.path);
			const { action } = decideFile({
				current: onDisk,
				recorded: reads.record[projectPath] ?? null,
				rendered,
				force: reads.force,
			});
			return { ...file, projectPath, rendered, action, current: onDisk === rendered };
		});
		return { name: t.name, rel: t.rel, runtime, ownSetup, files };
	});
}
