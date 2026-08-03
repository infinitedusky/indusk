import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	fixtureDir,
	finishStep,
	guineaPigHappyPathSteps,
	realGateScripts,
} from "./harness.test-support.js";
import { runLoop } from "./loop.js";

/**
 * A6 + A7 + A8 (dawn-hook-parity) — headless `ask` = pause.
 *
 * A6: an `ask`-policy plan whose gates carry proof-less "(none needed)"
 * opt-outs pauses the run — a distinct paused status carrying the gate
 * question — instead of red-stopping or proceeding. Red at authoring: the
 * probe's ask-mode refusal surfaces as `stopped-red`.
 *
 * A7: after conversation proof is added, a re-run continues past the phase.
 * Red at authoring via the first run's status.
 *
 * A8: no `gate_policy` frontmatter behaves as `ask` in the thin lane;
 * explicit `auto` runs unpaused as today. Red at authoring: unset policy is
 * treated as auto by contract.
 */

async function makeFixtureWorktree(prefix: string, policy: "ask" | "auto" | "unset") {
	const root = await mkdtemp(join(tmpdir(), `${prefix}-`));
	await cp(fixtureDir, root, { recursive: true });
	const implPath = join(root, "impl.md");
	const impl = await readFile(implPath, "utf8");
	if (policy === "ask") {
		await writeFile(implPath, impl.replace("gate_policy: auto", "gate_policy: ask"), "utf8");
	} else if (policy === "unset") {
		await writeFile(implPath, impl.replace(/^gate_policy: auto\n/m, ""), "utf8");
	}
	return root;
}

async function runScripted(root: string) {
	const impl = await readFile(join(root, "impl.md"), "utf8");
	const model = new MockLanguageModelV4({
		doGenerate: guineaPigHappyPathSteps(impl),
	});
	return runLoop({ worktree: root, model, gate: { scripts: realGateScripts } });
}

/** Check off the proof-less gate items with conversation proof, as a human would. */
async function addConversationProof(root: string) {
	const implPath = join(root, "impl.md");
	const impl = await readFile(implPath, "utf8");
	const proofed = impl.replaceAll(
		/- \[ \] \(none needed\)([^\n]*)/g,
		'- [x] (none needed — asked: "This is a fixture; may I skip this gate?" — user: "yes, skip it")$1',
	);
	await writeFile(implPath, proofed, "utf8");
}

describe("A6 — ask-policy gate skips pause the run with the question", () => {
	let root: string;

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("pauses (not red, not complete) and surfaces the proof format", async () => {
		root = await makeFixtureWorktree("dawn-ask-a6", "ask");
		const result = await runScripted(root);

		expect(result.status).toBe("paused-gate-question");
		if (result.status !== "paused-gate-question") return;
		expect(result.phase).toBe(1);
		// The pause carries the gate question a human must answer, in the
		// conversation-proof format check-gates demands.
		expect(result.reason).toContain("ask");
		expect(result.reason).toMatch(/asked:.*user:/s);
	});
});

describe("A7 — proof added, the re-run continues past the phase", () => {
	let root: string;

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("first run pauses; after proof the run completes", async () => {
		root = await makeFixtureWorktree("dawn-ask-a7", "ask");

		const first = await runScripted(root);
		expect(first.status).toBe("paused-gate-question");

		await addConversationProof(root);

		// The phase's real work happened in run 1; run 2 sees a complete phase.
		const second = await runLoop({
			worktree: root,
			model: new MockLanguageModelV4({ doGenerate: [finishStep("nothing left to do")] }),
			gate: { scripts: realGateScripts },
		});
		expect(second.status).toBe("complete");
	});
});

describe("A8 — unset policy means ask; explicit auto stays unpaused", () => {
	let root: string;

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("treats a plan without gate_policy as ask (pauses on proof-less opt-outs)", async () => {
		root = await makeFixtureWorktree("dawn-ask-a8-unset", "unset");
		const result = await runScripted(root);
		expect(result.status).toBe("paused-gate-question");
	});

	it("runs an explicit gate_policy: auto plan to complete, as today", async () => {
		root = await makeFixtureWorktree("dawn-ask-a8-auto", "auto");
		const result = await runScripted(root);
		expect(result.status).toBe("complete");
	});
});
