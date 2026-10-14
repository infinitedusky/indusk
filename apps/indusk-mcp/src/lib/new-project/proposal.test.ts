import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	loadProposal,
	ProposalError,
	readProposal,
	saveProposal,
	validateProposal,
} from "./proposal.js";

// promise: the-core-is-always-kept

const made: string[] = [];
afterEach(() => {
	for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const valid = () => ({
	name: "homework-gate",
	location: "/projects/homework-gate-workbench",
	repos: [{ name: "homework-gate" }],
	milestones: ["lockdown-baseline", "parent-dashboard"],
	recommendations: [
		{ name: "docs-site", kept: true },
		{ name: "adr", kept: false, reason: "Solo project for now" },
	],
	documentsOff: ["adr"],
	remote: { github: false },
});

const problemsOf = (over: Record<string, unknown>) =>
	validateProposal({ ...valid(), ...over }).problems.join(" | ");

describe("a project proposal", () => {
	it("reads the shape the agent writes", () => {
		const { proposal, problems } = validateProposal(valid());
		expect(problems).toEqual([]);
		expect(proposal).toEqual(valid());
	});

	it("refuses turning off the brief or the test plan, naming the document", () => {
		expect(problemsOf({ documentsOff: ["brief"] })).toContain("brief cannot be turned off");
		expect(problemsOf({ documentsOff: ["adr", "test-plan"] })).toContain(
			"test-plan cannot be turned off",
		);
	});

	it("refuses a document that is not a planning document", () => {
		expect(problemsOf({ documentsOff: ["roadmap"] })).toContain(
			"roadmap is not a planning document",
		);
	});

	it("needs the person's reason beside a declined recommendation", () => {
		expect(problemsOf({ recommendations: [{ name: "adr", kept: false }] })).toContain(
			"declining adr needs the person's reason",
		);
		expect(problemsOf({ recommendations: [{ name: "adr", kept: false, reason: "  " }] })).toContain(
			"declining adr",
		);
	});

	it("drops a reason from a kept recommendation", () => {
		const { proposal } = validateProposal({
			...valid(),
			recommendations: [{ name: "docs-site", kept: true, reason: "stale" }],
		});
		expect(proposal?.recommendations).toEqual([{ name: "docs-site", kept: true }]);
	});

	it("refuses a name or repository that is not one clean folder name, and a relative location", () => {
		expect(problemsOf({ name: "Homework Gate" })).toContain("name must be");
		expect(problemsOf({ repos: [{ name: "../escape" }] })).toContain("not a usable folder name");
		expect(problemsOf({ repos: [] })).toContain("at least one repository");
		expect(problemsOf({ repos: [{ name: "a" }, { name: "a" }] })).toContain("twice");
		expect(problemsOf({ location: "relative/dir" })).toContain("absolute");
	});

	it("reports every problem at once, and an object that is not a proposal", () => {
		expect(validateProposal({}).problems.length).toBeGreaterThan(3);
		expect(validateProposal("nope").problems).toEqual(["the proposal is not an object"]);
	});

	it("is read from the draft, and a missing or broken file is a problem, not a crash", () => {
		const dir = mkdtempSync(join(tmpdir(), "proposal-"));
		made.push(dir);
		const draft = { id: "d", dir };
		expect(loadProposal(draft).problems[0]).toContain("has not written a proposal");
		writeFileSync(join(dir, "proposal.json"), "{ nope");
		expect(loadProposal(draft).problems[0]).toContain("not readable");
		expect(() => readProposal(draft)).toThrow(ProposalError);
		writeFileSync(join(dir, "proposal.json"), JSON.stringify(valid()));
		expect(readProposal(draft).name).toBe("homework-gate");
	});

	it("keeps the person's edits after the same check, and writes nothing for a bad one", () => {
		const dir = mkdtempSync(join(tmpdir(), "proposal-"));
		made.push(dir);
		const draft = { id: "d", dir };
		saveProposal(draft, { ...valid(), name: "homework-gate-2" });
		expect(JSON.parse(readFileSync(join(dir, "proposal.json"), "utf-8")).name).toBe(
			"homework-gate-2",
		);
		expect(() => saveProposal(draft, { ...valid(), documentsOff: ["brief"] })).toThrow(/brief/);
		expect(JSON.parse(readFileSync(join(dir, "proposal.json"), "utf-8")).documentsOff).toEqual([
			"adr",
		]);
	});
});
