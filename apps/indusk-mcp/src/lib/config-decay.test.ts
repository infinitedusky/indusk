import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	DEFAULT_DEAD_DRAFT_DAYS,
	DEFAULT_SWEEP_TTL_MINUTES,
	ensureDecayConfig,
	getDeadDraftDays,
	getSweepTtlMinutes,
} from "./config.js";

/**
 * indusk-makeover Phase 1/3 supporting coverage. ensureDecayConfig runs on
 * every `indusk update` — surfaced as untested by the eval agent's findings
 * during this very plan's execution. Presence-keyed (H8 precedent): user-
 * customized values are never clobbered.
 */

describe("decay config", () => {
	let projectRoot: string;

	function writeCfg(cfg: object): void {
		writeFileSync(join(projectRoot, ".indusk/config.json"), JSON.stringify(cfg));
	}

	function readCfg(): {
		agents?: { sweep_ttl_minutes?: number; stale_ttl_minutes?: number };
		planning?: { dead_draft_days?: number };
	} {
		return JSON.parse(readFileSync(join(projectRoot, ".indusk/config.json"), "utf-8"));
	}

	beforeEach(() => {
		projectRoot = mkdtempSync(join(tmpdir(), "indusk-decay-config-"));
		mkdirSync(join(projectRoot, ".indusk"), { recursive: true });
	});

	afterEach(() => {
		rmSync(projectRoot, { recursive: true, force: true });
	});

	it("readers default when config or keys are absent", () => {
		expect(getSweepTtlMinutes(projectRoot)).toBe(DEFAULT_SWEEP_TTL_MINUTES);
		expect(getDeadDraftDays(projectRoot)).toBe(DEFAULT_DEAD_DRAFT_DAYS);
		writeCfg({ mode: "full" });
		expect(getSweepTtlMinutes(projectRoot)).toBe(DEFAULT_SWEEP_TTL_MINUTES);
		expect(getDeadDraftDays(projectRoot)).toBe(DEFAULT_DEAD_DRAFT_DAYS);
	});

	it("ensureDecayConfig scaffolds both keys into an existing config", () => {
		writeCfg({ mode: "full" });
		expect(ensureDecayConfig(projectRoot)).toBe("added");
		const cfg = readCfg();
		expect(cfg.agents?.sweep_ttl_minutes).toBe(DEFAULT_SWEEP_TTL_MINUTES);
		expect(cfg.planning?.dead_draft_days).toBe(DEFAULT_DEAD_DRAFT_DAYS);
	});

	it("ensureDecayConfig is idempotent and never clobbers customized values", () => {
		writeCfg({
			mode: "full",
			agents: { stale_ttl_minutes: 45, sweep_ttl_minutes: 99 },
			planning: { dead_draft_days: 7 },
		});
		expect(ensureDecayConfig(projectRoot)).toBe("already-set");
		const cfg = readCfg();
		expect(cfg.agents?.sweep_ttl_minutes).toBe(99);
		expect(cfg.agents?.stale_ttl_minutes).toBe(45);
		expect(cfg.planning?.dead_draft_days).toBe(7);
	});

	it("ensureDecayConfig fills only the missing key, preserving sibling fields", () => {
		writeCfg({ mode: "full", agents: { stale_ttl_minutes: 45 } });
		expect(ensureDecayConfig(projectRoot)).toBe("added");
		const cfg = readCfg();
		expect(cfg.agents?.stale_ttl_minutes).toBe(45); // sibling preserved
		expect(cfg.agents?.sweep_ttl_minutes).toBe(DEFAULT_SWEEP_TTL_MINUTES);
		expect(cfg.planning?.dead_draft_days).toBe(DEFAULT_DEAD_DRAFT_DAYS);
	});

	it("ensureDecayConfig reports no-config on an uninitialized directory", () => {
		expect(ensureDecayConfig(projectRoot)).toBe("no-config");
	});
});
