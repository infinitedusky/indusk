import { describe, expect, it } from "vitest";
import { activityLines, addRuns, startActivity } from "./activity.js";
import { line, site } from "./fixture.js";
import { hover } from "./hover.js";
import { markers } from "./markers.js";
import { panelModel } from "./panel.js";
import { panelBody } from "./panel-html.js";
import { type HealthLine, titleOf, type View } from "./view.js";

/**
 * display-names A1, A4, A5, A9: the panel, the activity section and the hover
 * name a promise in words and a plan by its title, as the health line carries
 * them (the package's `promises/display` worked them out); the marker at the
 * end of a code line keeps the handle. The editor never makes words itself.
 *
 * promise: a-promise-reads-as-words
 * promise: a-plan-reads-by-its-title
 */

const HANDLE = "seats-held";
const WORDS = "A break reaches the editor";

function named(over: { broken?: boolean; dates?: unknown } = {}): View {
	const l = line({ productionState: over.broken ? "red" : "green" }) as HealthLine;
	const p = l.promises[0] as unknown as Record<string, unknown>;
	p.title = WORDS;
	p.plan = "vscode-extension";
	p.planTitle = "VS Code extension";
	p.planDates = over.dates ?? { started: null, landed: null, released: null };
	return { line: l, notReading: false };
}

describe("names on the panel, the activity and the hover", () => {
	it("A1 — a promise reads in words on its card, its row, its activity line and its hover heading", () => {
		const broken = panelModel(named({ broken: true }), new Map());
		expect(broken.broken[0]?.title).toBe(WORDS);
		expect(panelBody(broken, [])).toMatch(new RegExp(`class="name">${WORDS}<`));

		const ok = panelModel(named(), new Map());
		expect(ok.groups[0]?.promises.find((p) => p.name === HANDLE)?.title).toBe(WORDS);
		expect(panelBody(ok, [])).toMatch(new RegExp(`class="name">${WORDS}<`));

		const view = named();
		const run = {
			promise: HANDLE,
			source: "local",
			outcome: "upheld" as const,
			at: "2026-10-08T12:00:01.000Z",
			traceId: "t-1",
		};
		const lines = activityLines(
			addRuns(startActivity(), [run]),
			() => "12:00",
			(h) => titleOf(view, h),
		);
		expect(lines).toEqual([`${WORDS} held (local) · 12:00`]);

		expect(hover(HANDLE, view).split("\n")[0]).toMatch(new RegExp(`^\\*\\*${WORDS}\\*\\*`));
	});

	it("A1 — a line without words falls back to the handle", () => {
		const bare: View = { line: line(), notReading: false };
		expect(panelBody(panelModel(bare, new Map()), [])).toContain(`class="name">${HANDLE}<`);
		expect(hover(HANDLE, bare)).toMatch(new RegExp(`^\\*\\*${HANDLE}\\*\\*`));
	});

	it("A4 — opening a promise shows its full sentence", () => {
		const html = panelBody(panelModel(named(), new Map()), []);
		expect(html).toMatch(/<p class="statement">A seat is never held by two players at once\.<\/p>/);
	});

	it("A5 — a plan's group and a broken card's plan read by the brief's title; a missing title falls back to the folder", () => {
		const m = panelModel(named(), new Map());
		expect(m.groups[0]?.planTitle).toBe("VS Code extension");
		expect(panelBody(m, [])).toMatch(/<h2 class="plan">VS Code extension/);

		const card = panelBody(panelModel(named({ broken: true }), new Map()), []);
		expect(card).toContain("plan VS Code extension");
		expect(card).not.toContain("plan vscode-extension");

		const bare = panelModel({ line: line(), notReading: false }, new Map());
		expect(bare.groups[0]?.planTitle).toBe(bare.groups[0]?.plan);
	});

	it("A5 — a plan group shows when it started, landed and was released, or that it is not released yet", () => {
		const body = (dates: unknown) => panelBody(panelModel(named({ dates }), new Map()), []);
		expect(
			body({
				started: "2026-10-08",
				landed: "2026-10-09",
				released: { version: "1.68.0", date: "2026-10-09" },
			}),
		).toContain("started 2026-10-08, landed 2026-10-09, released 1.68.0 (2026-10-09)");
		expect(body({ started: "2026-10-08", landed: "2026-10-09", released: null })).toContain(
			"started 2026-10-08, landed 2026-10-09, not released yet",
		);
		const running = body({ started: "2026-10-08", landed: null, released: null });
		expect(running).toContain("started 2026-10-08");
		expect(running).not.toContain("landed");
	});

	it("A9 — the marker at the end of a code line still shows the promise's handle", () => {
		const text = site(HANDLE, "mark(); ");
		const [m] = markers({ path: "src/telemetry.ts", text }, named());
		expect(m?.text.startsWith(`${HANDLE} · `)).toBe(true);
		expect(m?.text).not.toContain(WORDS);
	});
});
