import { describe, expect, it } from "vitest";
import { isAuditSkipped, isCleanupSkipped } from "../cleanup/gate.js";
import { isFalsificationSkipped } from "../falsification/skip.js";
import { isRitualSkipped } from "./skip.js";

type Ritual = "falsification" | "cleanup" | "audit";

const RITUALS: Array<{
	ritual: Ritual;
	wrapper: (impl: string) => ReturnType<typeof isRitualSkipped>;
}> = [
	{ ritual: "falsification", wrapper: isFalsificationSkipped },
	{ ritual: "cleanup", wrapper: isCleanupSkipped },
	{ ritual: "audit", wrapper: isAuditSkipped },
];

const NOT_SKIPPED = { skipped: false, reason: null };

function impl(frontmatter: string): string {
	return `---\n${frontmatter}\n---\n\n# body\n`;
}

for (const { ritual, wrapper } of RITUALS) {
	const other = RITUALS.find((r) => r.ritual !== ritual)?.ritual as Ritual;

	describe(`isRitualSkipped(${ritual})`, () => {
		const cases: Array<[string, string, { skipped: boolean; reason: string | null }]> = [
			[
				"skip pair with a reason is a skip, reason trimmed",
				impl(`${ritual}: skipped\n${ritual}_reason: "  trivial plan  "`),
				{ skipped: true, reason: "trivial plan" },
			],
			["a bare flag is not a skip", impl(`${ritual}: skipped`), NOT_SKIPPED],
			[
				"an empty reason is not a skip",
				impl(`${ritual}: skipped\n${ritual}_reason: ""`),
				NOT_SKIPPED,
			],
			[
				"a whitespace reason is not a skip",
				impl(`${ritual}: skipped\n${ritual}_reason: "   "`),
				NOT_SKIPPED,
			],
			[
				"a non-string reason is not a skip",
				impl(`${ritual}: skipped\n${ritual}_reason: 42`),
				NOT_SKIPPED,
			],
			[
				"another ritual's pair is not a skip",
				impl(`${other}: skipped\n${other}_reason: "x"`),
				NOT_SKIPPED,
			],
			["unparsable frontmatter is not a skip", "---\n: : [unclosed\n---\n", NOT_SKIPPED],
		];

		for (const [name, content, expected] of cases) {
			it(`${name}, and the named wrapper answers the same`, () => {
				expect(isRitualSkipped(content, ritual)).toEqual(expected);
				expect(wrapper(content)).toEqual(isRitualSkipped(content, ritual));
			});
		}
	});
}
