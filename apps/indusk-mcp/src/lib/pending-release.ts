/**
 * The release this machine just uploaded, and whether npm will serve it yet.
 *
 * Since npm's publish-time malware scanning (GitHub Changelog, 2026-07-28), a
 * version is not installable for about five minutes after `npm publish`
 * returns — fifteen or more at peak or for a large package — and npm answers
 * 404 for it meanwhile, exactly as for a version that does not exist. Only the
 * machine that ran the release knows a version is on its way, so
 * `record-release.js` writes it here and `indusk upgrade` reports on *that*
 * version instead of saying the old one is "already" current.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { induskHome } from "./version-check.js";

export interface PendingRelease {
	name: string;
	version: string;
	/** ISO time `pnpm publish` returned. */
	uploadedAt: string;
}

/** npm's stated range: "typically around five minutes … up to 15 minutes or more". */
export const TYPICAL_SCAN_MINUTES = 5;
export const OVERDUE_SCAN_MINUTES = 30;

export function pendingReleasePath(): string {
	return join(induskHome(), "pending-release.json");
}

export function recordPendingRelease(release: PendingRelease): void {
	const path = pendingReleasePath();
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(release, null, 2)}\n`);
}

/** The recorded release, or null when there is none or the file is not one. */
export function readPendingRelease(): PendingRelease | null {
	const path = pendingReleasePath();
	if (!existsSync(path)) return null;
	try {
		const data = JSON.parse(readFileSync(path, "utf-8")) as Partial<PendingRelease>;
		if (typeof data.name !== "string" || typeof data.version !== "string") return null;
		if (typeof data.uploadedAt !== "string" || Number.isNaN(Date.parse(data.uploadedAt)))
			return null;
		return data as PendingRelease;
	} catch {
		return null;
	}
}

export function clearPendingRelease(): void {
	rmSync(pendingReleasePath(), { force: true });
}

export type RegistryAnswer =
	| { state: "live" }
	| { state: "absent" }
	| { state: "unknown"; reason: string };

/**
 * Does npm serve `name@version` yet? `absent` is npm's 404 — still scanning, or
 * never uploaded; `unknown` is anything else (offline, auth), with the error
 * line that says so rather than the first stderr line, which is often an
 * unrelated npm warning.
 */
export function registryHasVersion(name: string, version: string): RegistryAnswer {
	try {
		const out = execFileSync(
			"npm",
			["view", `${name}@${version}`, "version", "--fetch-timeout=10000"],
			{ encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 },
		).trim();
		return out === version ? { state: "live" } : { state: "absent" };
	} catch (err) {
		const stderr = String((err as { stderr?: unknown }).stderr ?? (err as Error).message);
		if (/\bE404\b|\b404\b/.test(stderr)) return { state: "absent" };
		const line =
			stderr.split("\n").find((l) => /\berror\b/i.test(l)) ?? stderr.split("\n")[0] ?? "";
		return { state: "unknown", reason: line.trim() };
	}
}

/** True when dotted version `a` is newer than `b` (numeric per part; prerelease tags ignored). */
export function isNewerVersion(a: string, b: string): boolean {
	const parts = (v: string) =>
		v
			.split("-")[0]
			.split(".")
			.map((n) => Number.parseInt(n, 10) || 0);
	const [x, y] = [parts(a), parts(b)];
	for (let i = 0; i < Math.max(x.length, y.length); i++) {
		if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
	}
	return false;
}

/** Whole minutes since the upload, never negative. */
export function minutesSince(uploadedAt: string, now: Date = new Date()): number {
	return Math.max(0, Math.floor((now.getTime() - Date.parse(uploadedAt)) / 60_000));
}

/** What `indusk upgrade` says about a release it is waiting for. */
export function describeWaitingRelease(
	release: PendingRelease,
	answer: Exclude<RegistryAnswer, { state: "live" }>,
	now: Date = new Date(),
): string {
	const minutes = minutesSince(release.uploadedAt, now);
	const ago = minutes === 1 ? "1 min ago" : `${minutes} min ago`;
	if (answer.state === "unknown") {
		return `v${release.version} was uploaded ${ago}, and npm could not be asked whether it is live (${answer.reason}). Try again.`;
	}
	if (minutes >= OVERDUE_SCAN_MINUTES) {
		return `v${release.version} was uploaded ${ago} and npm still does not serve it — longer than npm's stated range for its publish-time scan. Check https://www.npmjs.com/package/${release.name}.`;
	}
	return `v${release.version} was uploaded ${ago} and is still in npm's publish-time malware scan — not installable yet (usually ~${TYPICAL_SCAN_MINUTES} min, can be 15+). Run \`indusk upgrade\` again shortly.`;
}
