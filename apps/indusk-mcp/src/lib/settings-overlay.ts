import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const OVERLAY_PATH = ".indusk/settings-overlay.json";
const SETTINGS_PATH = ".claude/settings.json";

export function getOverlayPath(projectRoot: string): string {
	return join(projectRoot, OVERLAY_PATH);
}

export function writeOverlay(projectRoot: string, additions: Record<string, unknown>): void {
	const overlayPath = getOverlayPath(projectRoot);
	mkdirSync(dirname(overlayPath), { recursive: true });
	writeFileSync(overlayPath, `${JSON.stringify(additions, null, "\t")}\n`);
}

export function readOverlay(projectRoot: string): Record<string, unknown> | null {
	const overlayPath = getOverlayPath(projectRoot);
	if (!existsSync(overlayPath)) return null;
	return JSON.parse(readFileSync(overlayPath, "utf-8"));
}

/**
 * Merge overlay additions into .claude/settings.json.
 * Deep-merges objects, concatenates arrays (deduplicating strings).
 */
export function applyOverlay(projectRoot: string): void {
	const overlay = readOverlay(projectRoot);
	if (!overlay) return;

	const settingsPath = join(projectRoot, SETTINGS_PATH);
	const existing = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf-8")) : {};

	const merged = deepMerge(existing, overlay);
	mkdirSync(dirname(settingsPath), { recursive: true });
	writeFileSync(settingsPath, `${JSON.stringify(merged, null, "\t")}\n`);
}

/**
 * Remove overlay additions from .claude/settings.json.
 * Strips keys/values that came from the overlay.
 */
export function stripOverlay(projectRoot: string): void {
	const overlay = readOverlay(projectRoot);
	if (!overlay) return;

	const settingsPath = join(projectRoot, SETTINGS_PATH);
	if (!existsSync(settingsPath)) return;

	const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
	const cleaned = deepStrip(settings, overlay);
	writeFileSync(settingsPath, `${JSON.stringify(cleaned, null, "\t")}\n`);
}

function deepMerge(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> {
	const result = { ...target };
	for (const [key, sourceVal] of Object.entries(source)) {
		const targetVal = result[key];
		if (Array.isArray(sourceVal) && Array.isArray(targetVal)) {
			// Concatenate arrays, dedup strings
			const combined = [...targetVal];
			for (const item of sourceVal) {
				if (typeof item === "string") {
					if (!combined.includes(item)) combined.push(item);
				} else {
					combined.push(item);
				}
			}
			result[key] = combined;
		} else if (isObject(sourceVal) && isObject(targetVal)) {
			result[key] = deepMerge(
				targetVal as Record<string, unknown>,
				sourceVal as Record<string, unknown>,
			);
		} else {
			result[key] = sourceVal;
		}
	}
	return result;
}

function deepStrip(
	target: Record<string, unknown>,
	overlay: Record<string, unknown>,
): Record<string, unknown> {
	const result = { ...target };
	for (const [key, overlayVal] of Object.entries(overlay)) {
		const targetVal = result[key];
		if (Array.isArray(overlayVal) && Array.isArray(targetVal)) {
			// Remove overlay items from array
			result[key] = targetVal.filter((item) => {
				if (typeof item === "string") {
					return !overlayVal.includes(item);
				}
				// For objects (hook entries), compare by JSON serialization
				const itemStr = JSON.stringify(item);
				return !overlayVal.some((ov) => JSON.stringify(ov) === itemStr);
			});
		} else if (isObject(overlayVal) && isObject(targetVal)) {
			result[key] = deepStrip(
				targetVal as Record<string, unknown>,
				overlayVal as Record<string, unknown>,
			);
		} else {
			delete result[key];
		}
	}
	return result;
}

function isObject(val: unknown): val is Record<string, unknown> {
	return typeof val === "object" && val !== null && !Array.isArray(val);
}
