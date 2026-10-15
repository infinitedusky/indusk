import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateCss, readFoundation } from "./foundation.js";

/** promise: a-mockup-leaves-nothing-undefined — the dark value a token names beside its light one. */
async function foundationWith(tokens: unknown) {
	const dir = await mkdtemp(join(tmpdir(), "foundation-"));
	await writeFile(join(dir, "foundation.tokens.json"), JSON.stringify(tokens));
	return readFoundation(dir);
}

const ink = {
	$value: { colorSpace: "srgb", components: [0.1, 0.1, 0.1], hex: "#1a1a1a" },
	$extensions: { "dev.indusk": { dark: "#eeeeee" } },
};
const paper = { $value: { colorSpace: "srgb", components: [1, 1, 1], hex: "#ffffff" } };

describe("a token's dark value", () => {
	it("is read beside the light one and emitted for the dark scheme", async () => {
		const f = await foundationWith({ color: { $type: "color", ink, paper } });
		expect(f.tokens.find((t) => t.name === "--color-ink")?.dark).toBe("#eeeeee");
		expect(f.tokens.find((t) => t.name === "--color-paper")?.dark).toBeUndefined();
		const css = generateCss(f);
		expect(css).toContain("--color-ink: #1a1a1a;");
		expect(css).toContain("@media (prefers-color-scheme: dark)");
		expect(css).toContain("--color-ink: #eeeeee;");
		// A token with no dark value is not repeated in the dark blocks.
		expect(css.split("--color-paper:").length).toBe(2);
	});

	it("emits no dark block when no token names one", async () => {
		const f = await foundationWith({ color: { $type: "color", paper } });
		expect(generateCss(f)).not.toContain("prefers-color-scheme");
		expect(generateCss(f, { tailwind: true })).not.toContain("prefers-color-scheme");
	});
});
