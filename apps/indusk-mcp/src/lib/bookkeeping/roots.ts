import { join } from "node:path";

export interface BookkeepingRoots {
	/** The main checkout: where notes people read are written and committed. */
	trunk: string;
	/** The project's home outside every checkout: InDusk's machine state. */
	home: string;
}

export function bookkeepingRoots(anyCheckout: string): BookkeepingRoots {
	return { trunk: anyCheckout, home: join(anyCheckout, ".indusk") };
}

/** Where evaluation results live. */
export function evalDir(anyCheckout: string): string {
	return join(anyCheckout, ".indusk", "eval");
}
