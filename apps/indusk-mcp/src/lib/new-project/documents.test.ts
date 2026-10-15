import { describe, expect, it } from "vitest";
import { documentNotice } from "./documents.js";

// promise: a-new-version-of-the-founding-brief-shows-what-changed

describe("what the agent is told when a document arrives", () => {
	it("sends the difference, and the instruction to work from the new version, when a name was replaced", () => {
		const text = documentNotice({
			name: "spec.md",
			replaced: true,
			diff: "-budget: 5\n+budget: 8",
		});
		expect(text).toContain("./documents/spec.md");
		expect(text).toContain("-budget: 5\n+budget: 8");
		expect(text).toContain("Work from the new version.");
	});

	it("says nothing differs when a replaced document is byte for byte the same", () => {
		expect(documentNotice({ name: "spec.md", replaced: true, diff: "" })).toContain(
			"(nothing differs)",
		);
	});

	it("points at a new document to read, with no difference", () => {
		const text = documentNotice({ name: "extra.md", replaced: false, diff: "" });
		expect(text).toBe("A document was added: ./documents/extra.md. Read it.");
	});
});
