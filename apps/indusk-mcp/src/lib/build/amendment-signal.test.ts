import { describe, expect, it } from "vitest";
import { captureTracer, outcomesByClause } from "../promises/capture-tracer.js";
import { markAmendmentStop } from "./amendment-signal.js";

// promise: an-audit-concern-gets-a-solution
// clause: an-audit-concern-gets-a-solution/a-significant-concern-goes-to-the-person

/** A29: the build's stop on a waiting amendment reports the significant-concern clause. */

const clause = "a-significant-concern-goes-to-the-person";

describe("A29 — an amendment stop reports the significant-concern clause", () => {
	it("is upheld when the build stopped on the amendment", async () => {
		const { tracer, spans } = captureTracer();
		await markAmendmentStop("/nowhere", "p", ["scope not-promised"], "amendment", tracer);
		expect(outcomesByClause(spans)).toEqual({ [clause]: "upheld" });
	});

	it("is broken when a session step began while an amendment waited", async () => {
		const { tracer, spans } = captureTracer();
		await markAmendmentStop("/nowhere", "p", ["scope not-promised"], "work", tracer);
		expect(outcomesByClause(spans)).toEqual({ [clause]: "broken" });
	});

	it("writes nothing when no amendment waits", async () => {
		const { tracer, spans } = captureTracer();
		await markAmendmentStop("/nowhere", "p", [], "work", tracer);
		expect(spans).toEqual([]);
	});
});
