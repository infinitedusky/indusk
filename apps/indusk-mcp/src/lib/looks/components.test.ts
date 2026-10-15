import { describe, expect, it } from "vitest";
import { componentReferences, isImplementationFile, markersIn } from "./components.js";

describe("markersIn", () => {
	it("finds a literal marker with its line, in each way a source writes one", () => {
		const text = [
			'<span data-component="badge" />',
			"<span data-component='card' />",
			'<span data-component={"nav"} />',
		].join("\n");
		expect(markersIn(text)).toEqual([
			{ name: "badge", line: 1 },
			{ name: "card", line: 2 },
			{ name: "nav", line: 3 },
		]);
	});

	it("reads a comment line as prose, and a name decided at run time as nothing", () => {
		const text = [
			'// the root carries data-component="chip"',
			' * data-component="chip"',
			"<span data-component={kind} />",
		].join("\n");
		expect(markersIn(text)).toEqual([]);
	});
});

describe("isImplementationFile", () => {
	it("is a markup source that is neither a test nor a story", () => {
		expect(isImplementationFile("src/components/ui/Badge.tsx")).toBe(true);
		expect(isImplementationFile("src/components/ui/Badge.stories.tsx")).toBe(false);
		expect(isImplementationFile("src/components/ui/Badge.test.tsx")).toBe(false);
		expect(isImplementationFile("src/__tests__/audit.ts")).toBe(false);
		expect(isImplementationFile("src/app/globals.css")).toBe(false);
	});
});

describe("componentReferences", () => {
	it("lists the components a mockup places by name, a missing state being default", () => {
		const html = [
			"<body>",
			'<indusk-component name="badge" state="ok"></indusk-component>',
			'<indusk-component name="card"></indusk-component>',
			"</body>",
		].join("\n");
		expect(componentReferences(html)).toEqual([
			{ name: "badge", state: "ok", line: 2 },
			{ name: "card", state: "default", line: 3 },
		]);
	});
});
