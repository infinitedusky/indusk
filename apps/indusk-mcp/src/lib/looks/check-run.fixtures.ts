import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Attributes, Tracer } from "@opentelemetry/api";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import type { ApprovalEntry, StoryApprovalEntry } from "./approvals.js";
import { approvedValues, type LookOpener, type Measured, type Scheme } from "./check.js";
import { type LooksApp, readApp, sourcesHashOf } from "./mockups.js";

/**
 * Helpers for the tests of `checkApp`'s decisions, which run without a browser
 * (looks-check-speed). `fixtureApp` is the `looks-app` fixture with a dark value
 * beside its colours, a story catalog and approvals bound to it as it is;
 * `fakeOpener` answers for each look by name and records which it was asked to
 * open.
 */

const FIXTURE = join(__dirname, "..", "..", "__tests__", "fixtures", "looks-app");

/** The app of the last `fixtureApp`: what a fake opener's "held" measurement is made from. */
let current: LooksApp | undefined;

export interface FixtureApp {
	/** The project: a copy of the fixture in a temp folder. */
	root: string;
	/** An InDusk home of its own, where the project's held results are kept. */
	home: string;
	app: LooksApp;
	approvals: ApprovalEntry[];
	storyApprovals: StoryApprovalEntry[];
}

/**
 * The fixture app with `mockups` approved as they are and `stories` (each
 * `<component>.<state>`) in a catalog and approved. Both light and dark are
 * named by its foundation, so every look is reported at `<device>` and
 * `<device>/dark`.
 */
export async function fixtureApp(
	mockups: string[],
	stories: string[] = [],
	extra: { serve?: string } = {},
): Promise<FixtureApp> {
	const root = mkdtempSync(join(tmpdir(), "check-run-fixture-"));
	cpSync(FIXTURE, root, { recursive: true });
	const app = await readApp(root, "demo");
	if (extra.serve) app.serve = extra.serve;
	app.foundation.tokens[0].dark = "#1f1a17";
	// Only the looks asked for are declared, so no unapproved look is listed beside them.
	app.screens = app.screens
		.map((s) => ({
			...s,
			states: s.states.filter((state) => mockups.includes(`${s.name}.${state}`)),
		}))
		.filter((s) => s.states.length > 0);
	const catalog = stories.map((name) => {
		const [component, state] = name.split(".") as [string, string];
		return {
			name: component,
			file: `${component}.tsx`,
			properties: [],
			states: [{ name: state, id: `${component}--${state}` }],
		};
	});
	mkdirSync(app.dir, { recursive: true });
	// Rendered from the sources as they are, so the fixture's looks can be reused.
	const renderedFrom = await sourcesHashOf(root, app);
	writeFileSync(
		join(app.dir, "components.json"),
		JSON.stringify({ renderedFrom, components: catalog }),
	);
	app.stories = stories.map((name) => {
		const [component, state] = name.split(".") as [string, string];
		return {
			name,
			component,
			state,
			file: `${name}.html`,
			html: "",
			hash: `hash-${name}`,
			stylesheetHash: null,
		};
	});
	const bound = {
		foundationHash: app.foundation.hash,
		declarationsHash: app.declarationsHash,
		by: "test",
		at: "2026-10-16T00:00:00.000Z",
	};
	const approvals = mockups.map((name) => {
		const m = app.mockups.find((x) => x.name === name);
		if (!m) throw new Error(`the fixture has no mockup ${name}`);
		return { mockup: name, mockupHash: m.hash, componentsHash: m.componentsHash, ...bound };
	});
	const storyApprovals = stories.map((name) => ({
		kind: "story" as const,
		story: name,
		snapshotHash: `hash-${name}`,
		...bound,
	}));
	current = app;
	const home = mkdtempSync(join(tmpdir(), "check-run-home-"));
	return { root, home, app, approvals, storyApprovals };
}

/** The page a served app answers a plain fetch with: one stylesheet, so the build has an identity. */
export const servedPage = async (): Promise<string> =>
	'<link rel="stylesheet" href="/_next/static/chunks/0my-dgs-thrfj.css">';

/**
 * What a fake opener answers for a look: held everywhere, a timeout, or held
 * everywhere but at the named devices (`phone/dark`), broken or unchecked there.
 */
export type Answer = "held" | "timeout" | Record<string, "broken" | "unchecked">;

export interface FakeOpener extends LookOpener {
	/** The looks it was asked to open, in order: `home.empty`, `story home.full`. */
	opened: string[];
	/** Whether anything was ever opened — the browser launches on the first. */
	launched: boolean;
}

/**
 * An opener that answers `answers[look]` for each look and fails the test on
 * one it was not given; `onOpen` runs as each look opens (another run's write,
 * mid-check).
 */
export function fakeOpener(
	answers: Record<string, Answer>,
	onOpen?: (look: string) => void | Promise<void>,
): FakeOpener {
	const opener: FakeOpener = {
		opened: [],
		launched: false,
		async open(target, devices, schemes) {
			opener.launched = true;
			opener.opened.push(target.look);
			await onOpen?.(target.look);
			const answer = answers[target.look];
			if (answer === undefined)
				throw new Error(`the fake opener was not told about ${target.look}`);
			if (answer === "timeout") {
				throw Object.assign(new Error(`page.goto: Timeout 30000ms exceeded (${target.look})`), {
					name: "TimeoutError",
				});
			}
			const app = current;
			if (!app) throw new Error("fakeOpener needs a fixtureApp first");
			const states = target.look.startsWith("story ") ? [] : [target.look];
			const at = (device: string): "held" | "broken" | "unchecked" =>
				typeof answer === "object" ? (answer[device] ?? "held") : "held";
			return devices.flatMap((d) =>
				schemes.map<Measured>((scheme: Scheme) => {
					const there = at(scheme === "light" ? d.name : `${d.name}/${scheme}`);
					const runtime = approvedValues(app, scheme);
					const first = app.foundation.tokens[0]?.name as string;
					return {
						runtime: there === "broken" ? { ...runtime, [first]: "#000001" } : runtime,
						elements: [],
						// A story reports no state; an unchecked one draws the other scheme.
						states: there === "unchecked" ? [] : states,
						scheme:
							there === "unchecked" && target.look.startsWith("story ")
								? scheme === "light"
									? "dark"
									: "light"
								: scheme,
					};
				}),
			);
		},
		async close() {},
	};
	return opener;
}

/** A tracer that keeps every span it ends, read back with `all()`. */
export function recordingTracer(): { tracer: Tracer; all(): { attributes: Attributes }[] } {
	const exporter = new InMemorySpanExporter();
	const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
	return { tracer: provider.getTracer("check-run"), all: () => exporter.getFinishedSpans() };
}
