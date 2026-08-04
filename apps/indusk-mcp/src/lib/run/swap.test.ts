import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDriverModel } from "./driver.js";
import {
	CLI_MJS,
	finishStep,
	fixtureDir,
	phase1ImplBlock,
	realGateScripts,
	rowLine,
	SEMVER_MJS,
	SEMVER_TEST_MJS,
	toolCallStep,
	phase1VerificationLine as verificationLine,
} from "./harness.test-support.js";
import { runLoop } from "./loop.js";
import { resolveModel, resolveProviderKey } from "./registry.js";

/**
 * T7 — the same guinea-pig plan runs via a non-Claude driver with the
 * identical gate firing: a premature checkoff is still blocked (exit 2, edit
 * not applied, block message surfaced to the model).
 *
 * Deterministic swap test: the GOOGLE driver config (Phase 4's Gemini entry)
 * plus a scripted MockLanguageModelV4 through the SAME loop with the REAL
 * gate scripts. The gate layers sit below the provider swap (own-the-execute)
 * and above it (toolApproval) — neither consults the provider — so this is
 * the structural model-invariance proof; the live `--model gemini` run is the
 * empirical datum on top.
 */

const execFileAsync = promisify(execFile);

/** The guinea-pig Phase 1 implementation item a premature checkoff flips. */
const PARSE_ITEM_UNCHECKED =
	"- [ ] `parse(input): { major, minor, patch }` — accept exactly three dot-separated non-negative integers; reject leading zeros, missing/extra segments, and non-numeric segments (throw).";
const PARSE_ITEM_CHECKED = PARSE_ITEM_UNCHECKED.replace("- [ ]", "- [x]");

/** One scripted model step that calls a tool. */

describe("gemini registry entry + provider-agnostic driver factory (T7 surface)", () => {
	it("resolves `gemini` to the google driver config with the flash default model", () => {
		const driver = resolveModel("gemini");
		expect(driver.provider).toBe("google");
		expect(driver.model).toBe("gemini-3.6-flash");
		expect(driver.apiKeyEnv).toBe("GOOGLE_GENERATIVE_AI_API_KEY");
		// The key-env bridge: accepted names in order, SDK default first, then
		// the machine convention this box actually uses.
		expect(driver.apiKeyEnvs).toEqual(["GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"]);
	});

	it("builds a real google model from the registry config — the factory is provider-agnostic", () => {
		const model = createDriverModel(resolveModel("gemini")) as unknown as {
			modelId: string;
			provider: string;
		};
		expect(model.modelId).toBe("gemini-3.6-flash");
		expect(model.provider).toContain("google");
	});

	it("still builds the anthropic model and keeps a clear not-yet error for the rest", () => {
		const claude = createDriverModel(resolveModel("claude")) as unknown as { modelId: string };
		expect(claude.modelId).toBe(resolveModel("claude").model);
		expect(() => createDriverModel(resolveModel("gpt"))).toThrow(/no driver yet/i);
		expect(() => createDriverModel(resolveModel("grok"))).toThrow(/no driver yet/i);
	});
});

describe("key-env bridge — first set env among the accepted names wins", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("falls back to GOOGLE_API_KEY when the SDK-default name is unset", () => {
		vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
		vi.stubEnv("GOOGLE_API_KEY", "fake-alias-key-for-test");
		expect(resolveProviderKey(resolveModel("gemini"))).toBe("fake-alias-key-for-test");
	});

	it("prefers the SDK-default name when both are set", () => {
		vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "fake-primary-key-for-test");
		vi.stubEnv("GOOGLE_API_KEY", "fake-alias-key-for-test");
		expect(resolveProviderKey(resolveModel("gemini"))).toBe("fake-primary-key-for-test");
	});

	it("returns undefined when no accepted env is set", () => {
		vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
		vi.stubEnv("GOOGLE_API_KEY", "");
		expect(resolveProviderKey(resolveModel("gemini"))).toBeUndefined();
	});
});

describe("the swap: guinea-pig plan via the google driver, identical gates (T7)", () => {
	let worktree: string;

	beforeEach(async () => {
		worktree = await mkdtemp(join(tmpdir(), "dawn-swap-t7-"));
		await cp(fixtureDir, worktree, { recursive: true });
	});

	afterEach(async () => {
		await rm(worktree, { recursive: true, force: true });
	});

	it("T7: a premature checkoff via the google driver is still blocked — exit 2, edit not applied, message surfaced", async () => {
		const before = await readFile(join(worktree, "impl.md"), "utf8");
		expect(before).toContain(PARSE_ITEM_UNCHECKED); // precondition: fixture text pinned

		// The scripted "Gemini" tries the premature checkoff (trajectory rows
		// still ⬜), then gives up — exactly the T3 violation, different driver.
		const model = new MockLanguageModelV4({
			doGenerate: [
				toolCallStep("edit", {
					path: "impl.md",
					old_string: PARSE_ITEM_UNCHECKED,
					new_string: PARSE_ITEM_CHECKED,
				}),
				finishStep("Checked off the parse item."),
			],
		});

		const result = await runLoop({
			worktree,
			model,
			driver: resolveModel("gemini"),
			gate: { scripts: realGateScripts },
		});

		// The loop never advanced: the deliberate check-gates probe stayed red.
		expect(result.status).toBe("stopped-red");
		if (result.status !== "stopped-red") return;
		expect(result.phase).toBe(1);
		expect(result.reason).toMatch(/Phase 1/);

		// The premature checkoff did NOT land — impl.md is byte-identical.
		const after = await readFile(join(worktree, "impl.md"), "utf8");
		expect(after).toBe(before);

		// The block message was surfaced back to the model: the SECOND generate
		// call's prompt carries the denial (the toolApproval layer fires above
		// the provider swap, before execute) with the gate's stderr as reason.
		expect(model.doGenerateCalls.length).toBe(2);
		const feedback = JSON.stringify(model.doGenerateCalls[1].prompt);
		expect(feedback).toMatch(/execution-denied/);
		expect(feedback).toMatch(/test-first violation/);
	});

	it("T7: after the block feeds back, the same loop still runs the plan to impl-complete via the google driver", async () => {
		const impl = await readFile(join(worktree, "impl.md"), "utf8");
		const rowsBlock = [rowLine(impl, "T1"), rowLine(impl, "T2"), rowLine(impl, "T3")].join("\n");
		const implBlock = phase1ImplBlock(impl);
		const verifLine = verificationLine(impl);

		// Same honest phase script as T5 — but the first step is the premature
		// checkoff, which the gate blocks; the "Gemini" then recovers and does
		// the work test-first. Identical gate firing, different driver config.
		const model = new MockLanguageModelV4({
			doGenerate: [
				toolCallStep("edit", {
					path: "impl.md",
					old_string: PARSE_ITEM_UNCHECKED,
					new_string: PARSE_ITEM_CHECKED,
				}),
				toolCallStep("writeFile", { path: "semver.test.mjs", content: SEMVER_TEST_MJS }),
				toolCallStep("edit", {
					path: "impl.md",
					old_string: rowsBlock,
					new_string: rowsBlock.replaceAll("| ⬜ |", "| written |"),
				}),
				toolCallStep("writeFile", { path: "semver.mjs", content: SEMVER_MJS }),
				toolCallStep("writeFile", { path: "cli.mjs", content: CLI_MJS }),
				toolCallStep("bash", { command: "node --test semver.test.mjs" }),
				toolCallStep("edit", {
					path: "impl.md",
					old_string: rowsBlock.replaceAll("| ⬜ |", "| written |"),
					new_string: rowsBlock.replaceAll("| ⬜ |", "| passing |"),
				}),
				toolCallStep("edit", {
					path: "impl.md",
					old_string: implBlock,
					new_string: implBlock.replaceAll("- [ ]", "- [x]"),
				}),
				toolCallStep("edit", {
					path: "impl.md",
					old_string: verifLine,
					new_string: verifLine.replace("- [ ]", "- [x]"),
				}),
				finishStep("Phase 1 complete after the gate pushed back on the premature checkoff."),
			],
		});

		const result = await runLoop({
			worktree,
			model,
			driver: resolveModel("gemini"),
			gate: { scripts: realGateScripts },
		});

		expect(result.status).toBe("complete");
		if (result.status !== "complete") return;
		expect(result.phases).toHaveLength(1);
		expect(result.phases[0]).toMatchObject({ phase: 1, steps: 10 });

		// The block round-tripped mid-run: the second call's prompt saw it.
		const feedback = JSON.stringify(model.doGenerateCalls[1].prompt);
		expect(feedback).toMatch(/test-first violation/);

		// The checkoff landed only the honest way — after green tests.
		const after = await readFile(join(worktree, "impl.md"), "utf8");
		expect(after).toContain(PARSE_ITEM_CHECKED);
		expect(rowLine(after, "T1")).toContain("| passing |");
		expect(rowLine(after, "T2")).toContain("| passing |");
		expect(rowLine(after, "T3")).toContain("| passing |");
		await expect(
			execFileAsync(process.execPath, ["--test", "semver.test.mjs"], { cwd: worktree }),
		).resolves.toBeTruthy();
	}, 30_000); // dawn-hook-parity: chain grew 2→3 gate scripts (a spawn per edit); this end-to-end run outgrew vitest's 5s default
});
