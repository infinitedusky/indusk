// promise: an-accepted-brief-is-planned-unasked
import { expect, it } from "vitest";
import { PACKAGE_ROOT_ENV } from "../package-root.js";
import { sessionEnv } from "./start.js";

it("T8 drops the handed package root and keeps the rest", () => {
	const env = sessionEnv({ [PACKAGE_ROOT_ENV]: "/other", KEEP: "1" });
	expect(env[PACKAGE_ROOT_ENV]).toBeUndefined();
	expect(env.KEEP).toBe("1");
});

it("T8 adds the caller's variables", () => {
	expect(sessionEnv({ KEEP: "1" }, { X: "y" })).toEqual({ KEEP: "1", X: "y" });
});

it("T8 keeps a package root the caller passes explicitly", () => {
	const env = sessionEnv({ [PACKAGE_ROOT_ENV]: "/other" }, { [PACKAGE_ROOT_ENV]: "/mine" });
	expect(env[PACKAGE_ROOT_ENV]).toBe("/mine");
});
