import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	AGED_AFTER_DAYS,
	createDraft,
	describeDraftAge,
	listDrafts,
	sweepDrafts,
} from "../lib/drafts/index.js";

/**
 * promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository
 *
 * brief-as-the-contract, Build Phase 5: a draft untouched for days reads as
 * aged on the page, and `drafts.max_age_days` is the age at which
 * `indusk plans archive-dead` discards it.
 */

let home: string;
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "drafts-age-"));
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

const DAY = 86_400_000;
function ageBy(dir: string, days: number): void {
	const then = new Date(Date.now() - days * DAY);
	for (const name of ["draft.json", "brief.md", "research.md"].filter((n) =>
		existsSync(join(dir, n)),
	))
		utimesSync(join(dir, name), then, then);
}

describe("drafts age", () => {
	it("a draft untouched for the aged threshold reads aged, a recent one does not", () => {
		const fresh = createDraft(home, { brief: "# fresh\n" });
		const old = createDraft(home, { brief: "# old\n" });
		ageBy(old.dir, AGED_AFTER_DAYS + 1);
		const byId = Object.fromEntries(listDrafts(home).map((d) => [d.id, d.aged]));
		expect(byId[fresh.id]).toBe(false);
		expect(byId[old.id]).toBe(true);
	});

	it("the sweep discards what is older than the maximum, and a dry run only reports it", () => {
		const keep = createDraft(home, { brief: "# keep\n" });
		const gone = createDraft(home, { brief: "# gone\n" });
		ageBy(gone.dir, 40);
		expect(sweepDrafts(home, { maxAgeDays: 30, dryRun: true })).toEqual([gone.id]);
		expect(listDrafts(home)).toHaveLength(2);
		expect(sweepDrafts(home, { maxAgeDays: 30 })).toEqual([gone.id]);
		expect(listDrafts(home).map((d) => d.id)).toEqual([keep.id]);
	});

	it("A36 an aged draft is moved to the home's archive of drafts with what it held, not deleted", () => {
		const gone = createDraft(home, { brief: "# gone\n", research: "# notes\n" });
		ageBy(gone.dir, 40);
		expect(sweepDrafts(home, { maxAgeDays: 30 })).toEqual([gone.id]);

		expect(listDrafts(home)).toEqual([]);
		const kept = join(home, "drafts", "archive", gone.id);
		expect(existsSync(join(kept, "brief.md"))).toBe(true);
		expect(readFileSync(join(kept, "brief.md"), "utf-8")).toBe("# gone\n");
		expect(readFileSync(join(kept, "research.md"), "utf-8")).toBe("# notes\n");
	});

	it("words the age as the page shows it", () => {
		const now = new Date("2026-10-13T12:00:00Z");
		const ago = (ms: number) => describeDraftAge(now.getTime() - ms, now);
		expect(ago(2 * 3_600_000)).toBe("last talked 2h ago");
		expect(ago(12 * DAY)).toBe("untouched 12 days");
	});
});
