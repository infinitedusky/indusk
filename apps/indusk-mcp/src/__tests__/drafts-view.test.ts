import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDraft, readDraftView, writeProposal } from "../lib/drafts/index.js";

/**
 * promise: a-plan-starts-as-a-conversation
 *
 * brief-as-the-contract, Build Phase 5: what a draft's page shows while the
 * conversation goes on — the promises, expectations and looks the brief has so
 * far, and the proposal — read from the draft's folder by the package.
 */

let home: string;
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "drafts-view-"));
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

const BRIEF = `# Phone nav

## Expectations

1. **People find the nav on a phone.**
   - Measure: taps to reach a plan
   - Look: after a week

## Promises

### This plan makes

1. **\`nav-opens-on-phone\`** (state). The nav opens from a menu button on a phone.

## Looks

### This plan makes

1. **\`nav.phone\`**. The nav opened on a phone.
`;

describe("a draft's view", () => {
	it("shows the parts of the brief the conversation has written and the proposal beside it", () => {
		const draft = createDraft(home, { brief: BRIEF });
		writeProposal(draft, { name: "phone-nav", type: "feature" });
		const view = readDraftView(home, draft.id);
		expect(view?.hasBrief).toBe(true);
		expect(view?.promises).toEqual(["nav-opens-on-phone"]);
		expect(view?.expectations).toEqual(["People find the nav on a phone."]);
		expect(view?.looks).toEqual(["nav.phone"]);
		expect(view?.proposal).toEqual({ name: "phone-nav", type: "feature" });
	});

	it("is empty before the agent has written anything, and null for a draft that is gone", () => {
		const draft = createDraft(home, {});
		const view = readDraftView(home, draft.id);
		expect(view).toMatchObject({ hasBrief: false, promises: [], looks: [], proposal: null });
		expect(readDraftView(home, "nope")).toBeNull();
	});
});
