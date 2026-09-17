import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * admin-ui-phase-progress — A21.
 *
 * The registry (`~/.indusk/projects.json`) has no prune: entries whose path
 * was deleted stay forever, and the file reached 1,588 entries with 1,577
 * dead. `indusk ui prune --dry-run` names them and writes nothing;
 * `indusk ui prune` removes exactly those, keeps every live entry, and leaves
 * a backup beside the registry the way the quarantine path does. Authored
 * RED in Test Phase 1 (`ui` has no `prune` subcommand); Build Phase 6.
 */

let home: string | null = null;
afterEach(() => {
	if (home) rmSync(home, { recursive: true, force: true });
	home = null;
});

interface Fixture {
	home: string;
	registry: string;
	before: string;
}

function fixture(): Fixture {
	home = mkdtempSync(join(tmpdir(), "ui-prune-home-"));
	const liveA = join(home, "live-a");
	const liveB = join(home, "live-b");
	mkdirSync(liveA);
	mkdirSync(liveB);
	const entry = (name: string, path: string) => ({
		name,
		path,
		registeredAt: "2026-09-01T00:00:00.000Z",
		lastSeenAt: "2026-09-01T00:00:00.000Z",
	});
	const registry = join(home, "projects.json");
	const before = `${JSON.stringify(
		{
			version: 1,
			projects: [
				entry("live-a", liveA),
				entry("dead-1", join(home, "gone-1")),
				entry("live-b", liveB),
				entry("dead-2", join(home, "gone-2")),
			],
		},
		null,
		2,
	)}\n`;
	writeFileSync(registry, before);
	return { home, registry, before };
}

function names(registry: string): string[] {
	const parsed = JSON.parse(readFileSync(registry, "utf-8")) as { projects: { name: string }[] };
	return parsed.projects.map((p) => p.name);
}

describe.skipIf(SHOULD_SKIP)("A21 — indusk ui prune", () => {
	it("--dry-run lists the dead entries and leaves the registry byte-identical", () => {
		const f = fixture();
		const r = runCli(f.home, ["ui", "prune", "--dry-run"], { INDUSK_HOME: f.home });
		expect(r.code, `${r.stdout}\n${r.stderr}`).toBe(0);
		expect(r.stdout).toContain("dead-1");
		expect(r.stdout).toContain("dead-2");
		expect(r.stdout).not.toContain("live-a");
		expect(readFileSync(f.registry, "utf-8")).toBe(f.before);
	});

	it("prune removes exactly the dead entries, keeps the live ones, and writes a backup", () => {
		const f = fixture();
		const r = runCli(f.home, ["ui", "prune"], { INDUSK_HOME: f.home });
		expect(r.code, `${r.stdout}\n${r.stderr}`).toBe(0);
		expect(names(f.registry)).toEqual(["live-a", "live-b"]);
		const backups = readdirSync(f.home).filter((n) => n.startsWith("projects.json.bak."));
		expect(backups, "no backup written beside the registry").toHaveLength(1);
		expect(readFileSync(join(f.home, backups[0]), "utf-8")).toBe(f.before);
		expect(existsSync(f.registry)).toBe(true);
	});
});
