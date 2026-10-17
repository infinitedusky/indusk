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
 * - `create`: the file is missing; write the rendering.
 * - `refresh`: the file is what InDusk recorded writing; write the newer rendering over it.
 * - `record`: the file already is the rendering; record it as InDusk's.
 * - `beside`: the file is not what InDusk recorded (edited, or never InDusk's); leave it and
 *   write the rendering beside it as `<file>.indusk-new`.
 */
export type FileAction = "create" | "refresh" | "record" | "beside";

export const BESIDE_SUFFIX = ".indusk-new";

export function sha256(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

/**
 * What to do with one file. Only a file whose content hashes to what InDusk recorded is
 * written over, so a person's edit and a file InDusk never wrote are never lost; a lost
 * record makes every file unrecorded, and an unrecorded file is never overwritten.
 * `force` (init's `--force`) overwrites whatever is there.
 */
export function decideFile(f: {
	current: string | null;
	recorded: string | null;
	rendered: string;
	force?: boolean;
}): { action: FileAction } {
	if (f.current === null) return { action: "create" };
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

export interface ScaffoldFile {
	/** The file under `templates/` it is rendered from. */
	template: string;
	/** Where it goes, relative to the target. */
	path: string;
	/** What it is, in the line printed about it. */
	purpose: string;
}

const SETTINGS = "OpenTelemetry settings — the daemon's address, service, project, environment";

/** The files a runtime gets. `hasSrc` puts a Node or browser app's files in its `src/`. */
export function filesFor(runtime: Runtime, hasSrc: boolean): ScaffoldFile[] {
	const at = hasSrc ? "src/" : "";
	switch (runtime) {
		case "node":
			return [
				{
					template: "instrumentation.ts",
					path: `${at}instrumentation.ts`,
					purpose: "OpenTelemetry Node SDK",
				},
				{
					template: "filtering-exporter.ts",
					path: `${at}filtering-exporter.ts`,
					purpose: "OpenTelemetry span exporter, category filter",
				},
				{
					template: "logger.ts",
					path: `${at}logger.ts`,
					purpose: "pino logger — OpenTelemetry log transport",
				},
				{
					template: "telemetry-settings.ts",
					path: `${at}telemetry-settings.ts`,
					purpose: SETTINGS,
				},
			];
		case "nextjs":
			// Next.js loads `instrumentation.ts` from the app root; the rest sit in `src/`,
			// where the root file reads the settings from.
			return [
				{
					template: "instrumentation.next.ts",
					path: "instrumentation.ts",
					purpose: "Next.js — @vercel/otel, OpenTelemetry",
				},
				{
					template: "logger.ts",
					path: "src/logger.ts",
					purpose: "pino logger — OpenTelemetry log transport",
				},
				{
					template: "instrumentation.web.ts",
					path: "src/instrumentation.web.ts",
					purpose: "browser — OTel Web SDK",
				},
				{ template: "telemetry-settings.ts", path: "src/telemetry-settings.ts", purpose: SETTINGS },
			];
		case "browser":
			return [
				{
					template: "instrumentation.web.ts",
					path: `${at}instrumentation.ts`,
					purpose: "React SPA — OpenTelemetry Web SDK",
				},
				{
					template: "telemetry-settings.ts",
					path: `${at}telemetry-settings.ts`,
					purpose: SETTINGS,
				},
			];
		case "python":
			return [
				{
					template: "instrumentation.py",
					path: "instrumentation.py",
					purpose: "OpenTelemetry Python SDK",
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
	/** The content of a file relative to the target, or null when it is missing. */
	current: (path: string) => string | null;
}

export interface ScaffoldReads {
	/** `.indusk/scaffold.json`: project-relative path → hash of what InDusk wrote there. */
	record: Record<string, string>;
	/** A template rendered for one service. */
	render: (template: string, service: string) => string;
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
	files: PlannedFile[];
}

const joinRel = (rel: string, path: string) => (rel === "" ? path : `${rel}/${path}`);

/** The scaffold for every target: its runtime, and each file with what to do with it. */
export function scaffoldPlan(targets: TargetRead[], reads: ScaffoldReads): PlannedTarget[] {
	return targets.map((t) => {
		if (!t.exists) return { name: t.name, rel: t.rel, runtime: "missing", files: [] };
		const runtime = detectRuntime(t.present);
		if (runtime === null) return { name: t.name, rel: t.rel, runtime, files: [] };
		const files = filesFor(runtime, t.hasSrc).map((file) => {
			const projectPath = joinRel(t.rel, file.path);
			const rendered = reads.render(file.template, t.name);
			const onDisk = t.current(file.path);
			const { action } = decideFile({
				current: onDisk,
				recorded: reads.record[projectPath] ?? null,
				rendered,
				force: reads.force,
			});
			return { ...file, projectPath, rendered, action, current: onDisk === rendered };
		});
		return { name: t.name, rel: t.rel, runtime, files };
	});
}
