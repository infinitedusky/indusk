import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { markProjectId } from "../promises/config.js";
import { induskHome } from "../telemetry/status.js";
import { gitCommonDirOf } from "../worktree/layout.js";

/**
 * Where InDusk's records live (bookkeeping-lives-where-it-is-read D1): one
 * place for notes people read, one for machine state, whichever checkout the
 * writer runs in. Every writer of `current.md`, lessons, the highlights queue,
 * the processed list and evaluation results goes through here. The hooks keep
 * a copy of the same rule (`hooks/_hook-paths.js`), pinned equal by a test.
 *
 * promise: indusk-leaves-main-clean
 */

export interface BookkeepingRoots {
	/** The main checkout: where notes people read are written and committed. */
	trunk: string;
	/** The project's home outside every checkout: InDusk's machine state. */
	home: string;
}

/** The folder holding the repository's shared git directory; `anyCheckout` itself outside git. */
export function mainCheckoutOf(anyCheckout: string): string {
	const common = gitCommonDirOf(anyCheckout);
	return common ? dirname(common) : anyCheckout;
}

/**
 * The home is keyed by the project's id and a short hash of its main
 * checkout's real path: the id alone (the committed `groupId`, or the folder
 * name) is the same in every clone of a project, and two clones on one machine
 * would share a queue and process each other's highlights (A18).
 */
export function bookkeepingRoots(anyCheckout: string): BookkeepingRoots {
	const trunk = mainCheckoutOf(anyCheckout);
	let real = trunk;
	try {
		real = realpathSync(trunk);
	} catch {
		// a checkout that is gone keys by the path it had
	}
	const hash = createHash("sha256").update(real).digest("hex").slice(0, 8);
	return { trunk, home: join(induskHome(), "projects", `${markProjectId(trunk)}-${hash}`) };
}

/** Where evaluation results live: the project's home, the same from every checkout. */
export function evalDir(anyCheckout: string): string {
	return join(bookkeepingRoots(anyCheckout).home, "eval");
}
