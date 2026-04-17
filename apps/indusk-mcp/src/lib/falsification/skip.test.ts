import { describe, expect, it } from "vitest";
import { isFalsificationSkipped } from "./skip.js";

const impl = (frontmatter: string) => `---
${frontmatter}
---

# Plan

## Goal

Something.

## Checklist

### Phase 1: Setup
- [ ] thing
`;

describe("T5: isFalsificationSkipped honors the two-field frontmatter opt-out", () => {
	it("returns skipped:true when both fields present with non-empty reason", () => {
		const body = impl(`title: "Test"
status: completed
falsification: skipped
falsification_reason: "2-line typo fix in a doc page"`);
		expect(isFalsificationSkipped(body)).toEqual({
			skipped: true,
			reason: "2-line typo fix in a doc page",
		});
	});

	it("returns skipped:false when frontmatter has no falsification fields", () => {
		const body = impl(`title: "Test"
status: completed`);
		expect(isFalsificationSkipped(body)).toEqual({ skipped: false, reason: null });
	});

	it("returns skipped:false when falsification is set but reason is missing", () => {
		const body = impl(`title: "Test"
falsification: skipped`);
		expect(isFalsificationSkipped(body)).toEqual({ skipped: false, reason: null });
	});

	it("returns skipped:false when reason is present but empty", () => {
		const body = impl(`title: "Test"
falsification: skipped
falsification_reason: ""`);
		expect(isFalsificationSkipped(body)).toEqual({ skipped: false, reason: null });
	});

	it("returns skipped:false when reason is whitespace-only", () => {
		const body = impl(`title: "Test"
falsification: skipped
falsification_reason: "   "`);
		expect(isFalsificationSkipped(body)).toEqual({ skipped: false, reason: null });
	});

	it("returns skipped:false when falsification has a different value", () => {
		const body = impl(`title: "Test"
falsification: "completed"
falsification_reason: "ignored"`);
		expect(isFalsificationSkipped(body)).toEqual({ skipped: false, reason: null });
	});

	it("returns skipped:false when falsification_reason is a non-string", () => {
		const body = impl(`title: "Test"
falsification: skipped
falsification_reason: 42`);
		expect(isFalsificationSkipped(body)).toEqual({ skipped: false, reason: null });
	});

	it("returns skipped:false on malformed frontmatter without throwing", () => {
		const body = `---
title: "Test"
: bad yaml : here
---

body`;
		expect(() => isFalsificationSkipped(body)).not.toThrow();
		expect(isFalsificationSkipped(body)).toEqual({ skipped: false, reason: null });
	});
});
