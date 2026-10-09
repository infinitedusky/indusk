import type { HealthLine } from "./view.js";

/**
 * A line of sample code carrying `name`'s token. Built, never spelled: the
 * registry check reads a spelled token in any file as a claim about this
 * project's promises.
 */
export function site(name: string, before = ""): string {
	const kind = "promise";
	return `${before}// ${kind}: ${name}\n`;
}

/** A health line as `indusk promises health --json` prints it, for the core's tests. */
export function line(
	over: {
		at?: string;
		productionState?: string;
		localState?: string;
		productionOk?: boolean;
		blind?: boolean;
		traceId?: string;
	} = {},
): HealthLine {
	const row = (state: string) => ({
		promise: "seats-held",
		state,
		lastSeen: "2026-10-08T12:20:00.000Z",
		violations: state === "red" ? 1 : 0,
		...(state === "red"
			? { symptom: "seat 4 held twice", traceId: over.traceId ?? "t-1", environment: "production" }
			: {}),
		tests: ["src/seats.test.ts"],
	});
	return {
		at: over.at ?? "2026-10-08T12:30:00.000Z",
		promises: [
			{
				name: "seats-held",
				kind: "behaviour",
				statement: "A seat is never held by two players at once.",
				tests: ["src/seats.test.ts"],
			},
			{
				name: "page-answers",
				kind: "state",
				statement: "The page answers.",
				tests: ["src/page.test.ts"],
			},
		],
		sources: [
			over.productionOk === false
				? over.blind
					? {
							name: "production",
							label: "https://x.fly.dev:16687",
							ok: false,
							reason: "watcher blind — …",
							blind: true,
						}
					: {
							name: "production",
							label: "https://x.fly.dev:16687",
							ok: false,
							reason: "could not be read: …",
						}
				: {
						name: "production",
						label: "https://x.fly.dev:16687",
						ok: true,
						rows: [row(over.productionState ?? "green")],
					},
			{
				name: "local",
				label: "http://localhost:16686",
				ok: true,
				rows: [row(over.localState ?? "green")],
			},
		],
	} as HealthLine;
}
