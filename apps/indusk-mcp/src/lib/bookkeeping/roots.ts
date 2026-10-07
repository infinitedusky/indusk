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

export function bookkeepingRoots(anyCheckout: string): BookkeepingRoots {
	const trunk = mainCheckoutOf(anyCheckout);
	return { trunk, home: join(induskHome(), "projects", markProjectId(trunk)) };
}

/** Where evaluation results live: the project's home, the same from every checkout. */
export function evalDir(anyCheckout: string): string {
	return join(bookkeepingRoots(anyCheckout).home, "eval");
}
