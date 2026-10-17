import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listApps, readAppLooks } from "../looks/overview.js";
import { type BriefContract, parseBriefContract } from "../promises/brief-contract.js";
import type { PromiseHealth } from "../promises/health.js";
import { parseFrontmatter, readPromises } from "../promises/registry.js";
import { type Amendment, amendmentsOf } from "./amendments.js";

/**
 * What a plan's page shows of its brief (brief-as-the-contract ADR decision
 * 7): its promises, its expectations and its looks, each with a name and a
 * state, and the amendments waiting on the person. The page draws this and
 * works out none of it.
 *
 * promise: a-plan-page-shows-the-parts-of-its-brief
 * promise: a-look-has-the-plan-that-owns-it
 */

export type LookRelation = "makes" | "changes" | "replaces" | "must-not-break";

export interface PartPromise {
	name: string;
	sentence: string;
	/** The registry's state; `unregistered` for one the brief makes that the registry lacks. */
	state: string;
	/** The promise's health from the alarm source; absent when telemetry says nothing about it. */
	health?: PromiseHealth;
}

export interface PartExpectation {
	text: string;
	measure: string | null;
	look: string | null;
}

export interface PartLook {
	name: string;
	relation: LookRelation;
	/** `undrawn` when no mockup or story of that name exists in the plan's checkout. */
	approval: "approved" | "proposed" | "undrawn";
	/** The plan that owns the look: the one its approval was made in; null when never approved. */
	plan: string | null;
	/** The app whose mockups hold it; null when undrawn. */
	app: string | null;
	/** The mockup as a page a frame can draw (`looks/overview`'s); null for a story or an undrawn look. */
	document: string | null;
	/** The app's reference devices, to draw the look at; empty when undrawn. */
	devices: Array<{ name: string; width: number; height: number }>;
}

export interface PlanParts {
	plan: string;
	/** False when the plan has no brief in the contract shape; the three parts are then empty. */
	hasBrief: boolean;
	/**
	 * Whether the plan has a `brief.md` at all. False only when there is none:
	 * a brief outside the contract shape is a file (`hasBriefFile` true,
	 * `hasBrief` false), which must not read as a brief with nothing in it.
	 */
	hasBriefFile: boolean;
	promises: PartPromise[];
	expectations: PartExpectation[];
	looks: PartLook[];
	/** `None — {reason}` of the brief's looks section; null when it lists looks or says nothing. */
	noLooks: string | null;
	amendments: Amendment[];
	/** Why the waiting amendments cannot be told; null when they can. */
	amendmentsUnreadable: string | null;
	/** What the plan is, in one to three sentences: the brief's `description`; null when it has none. */
	description: string | null;
	/** The brief's `status` (draft, accepted, …); null when there is no brief or it names none. */
	briefStatus: string | null;
}

type Drawn = Pick<PartLook, "plan" | "app" | "document" | "devices"> & {
	approval: "approved" | "proposed";
};

const EMPTY = (
	plan: string,
	hasBriefFile: boolean,
	opening: Pick<PlanParts, "description" | "briefStatus"> = {
		description: null,
		briefStatus: null,
	},
): PlanParts => ({
	plan,
	hasBrief: false,
	hasBriefFile,
	...opening,
	promises: [],
	expectations: [],
	looks: [],
	noLooks: null,
	amendments: [],
	amendmentsUnreadable: null,
});

/**
 * The brief's opening: its `status` and its `description`, the frontmatter
 * field that distills the plan in one to three sentences. Written by the
 * agent, never cut from the brief's prose — a long opening is not a summary.
 */
export function briefOpening(source: string): Pick<PlanParts, "description" | "briefStatus"> {
	const parsed = parseFrontmatter(source);
	const data = "error" in parsed ? {} : parsed.data;
	const field = (name: string) => {
		const value = data[name];
		return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
	};
	return { description: field("description"), briefStatus: field("status") };
}

/** The looks the brief lists, each under how the brief lists it. */
export function listedLooks(brief: BriefContract): Array<{ name: string; relation: LookRelation }> {
	const looks = brief.looks;
	if (!looks) return [];
	return [
		...looks.makes.map((l) => ({ name: l.name, relation: "makes" as const })),
		...looks.changes.map((l) => ({ name: l.name, relation: "changes" as const })),
		...looks.replaces.map((l) => ({ name: l.by, relation: "replaces" as const })),
		...looks.mustNotBreak.map((name) => ({ name, relation: "must-not-break" as const })),
	];
}

/**
 * The parts of `plan`'s brief. `root` is the checkout the plan is worked in
 * (its worktree, else the project), the plan's folder in it (under `archive/`
 * once archived) — the brief is read there, the registry and the mockups from the same checkout,
 * so what the page shows is what the plan's branch holds.
 */
export async function readPlanParts(
	root: string,
	plan: string,
	options: { archived?: boolean; health?: Record<string, PromiseHealth> } = {},
): Promise<PlanParts> {
	const dir = join(root, ".indusk", "planning", ...(options.archived ? ["archive"] : []), plan);
	const briefFile = join(dir, "brief.md");
	if (!existsSync(briefFile)) return EMPTY(plan, false);
	const source = readFileSync(briefFile, "utf-8");
	const opening = briefOpening(source);
	const brief = parseBriefContract(source);
	if (brief.shape === "legacy") return EMPTY(plan, true, opening);

	const read = readPromises(root);
	const registry = read.ok ? read.registry : "partial" in read ? read.partial : null;
	const byName = new Map((registry?.promises ?? []).map((p) => [p.name, p]));
	const names = new Set<string>([
		...brief.makes.map((m) => m.name),
		...(registry?.promises ?? []).filter((p) => p.owner === plan).map((p) => p.name),
	]);
	const promises: PartPromise[] = [...names].map((name) => {
		const entry = byName.get(name);
		const made = brief.makes.find((m) => m.name === name);
		const health = options.health?.[name];
		return {
			name,
			sentence: entry?.statement ?? made?.sentence ?? "",
			state: entry?.state ?? "unregistered",
			...(health ? { health } : {}),
		};
	});

	const apps = await Promise.all(listApps(root).map((app) => readAppLooks(root, app)));
	const drawn = new Map<string, Drawn>();
	for (const app of apps) {
		if ("problem" in app) continue;
		const devices = app.devices.map(({ name, width, height }) => ({ name, width, height }));
		for (const m of app.mockups) {
			drawn.set(m.name, {
				approval: m.approval,
				plan: m.plan,
				app: app.app,
				document: m.document,
				devices,
			});
		}
		for (const s of app.stories) {
			drawn.set(s.name, {
				approval: s.approval,
				plan: s.plan,
				app: app.app,
				document: null,
				devices,
			});
		}
	}
	const looks = listedLooks(brief).map(({ name, relation }) => {
		const found = drawn.get(name);
		return found
			? { name, relation, ...found }
			: {
					name,
					relation,
					approval: "undrawn" as const,
					plan: null,
					app: null,
					document: null,
					devices: [],
				};
	});

	let amendments: Amendment[] = [];
	let amendmentsUnreadable: string | null = null;
	try {
		amendments = await amendmentsOf(dir);
	} catch (err) {
		amendmentsUnreadable = (err as Error).message;
	}

	return {
		plan,
		hasBrief: true,
		hasBriefFile: true,
		promises,
		expectations: brief.expectations.map((e) => ({
			text: e.text,
			measure: e.measure,
			look: e.look,
		})),
		looks,
		noLooks: brief.looks?.none ?? null,
		amendments,
		amendmentsUnreadable,
		...opening,
	};
}
