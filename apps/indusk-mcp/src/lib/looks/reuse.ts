import type { LookTarget, StoryTarget } from "./check.js";
import type { LooksApp } from "./mockups.js";

/**
 * promise: a-look-check-costs-what-changed
 *
 * Not built yet: Build Phase 2 of looks-check-speed writes the rule. Until
 * then every look is reused, which is what the rows written red at the
 * phase's start hold against.
 */

interface KeyBase {
	name: string;
	foundationHash: string;
	declarationsHash: string;
	devices: string;
	schemes: string;
	current: boolean;
}

export interface StoryKey extends KeyBase {
	kind: "story";
	snapshotHash: string;
	stylesheetHash: string | null;
}

export interface ScreenKey extends KeyBase {
	kind: "screen";
	mockupHash: string;
	componentsHash: string;
	pageSourcesHash: string;
	path: string;
	seed: string;
	uncomposed: boolean;
}

export type LookKey = StoryKey | ScreenKey;

export interface Held {
	key: LookKey;
	at: string;
	state: "held" | "broken" | "unchecked";
}

export type Reuse = { reuse: true; at: string } | { reuse: false; changed: string };

export function lookKey(
	_app: LooksApp,
	_look: StoryTarget | LookTarget,
	_facts: { current: boolean; pageSourcesHash: string; schemes: readonly string[] },
): LookKey {
	return {
		kind: "story",
		name: "",
		foundationHash: "",
		declarationsHash: "",
		devices: "",
		schemes: "",
		current: true,
		snapshotHash: "",
		stylesheetHash: null,
	};
}

export function reuseOf(
	held: Held | undefined,
	_now: LookKey,
	_opts: { all?: boolean } = {},
): Reuse {
	return { reuse: true, at: held?.at ?? "" };
}

export function heldPath(_projectRoot: string, _app: string, _home?: string): string {
	return "";
}

export function readHeld(_projectRoot: string, _app: string, _home?: string): Record<string, Held> {
	return {};
}

export function writeHeld(
	_projectRoot: string,
	_app: string,
	_looks: Record<string, Held>,
	_home?: string,
): void {}
