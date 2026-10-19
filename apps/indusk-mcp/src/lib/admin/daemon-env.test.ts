// promise: an-accepted-brief-is-planned-unasked
import { expect, it } from "vitest";
import { PACKAGE_ROOT_ENV } from "../package-root.js";
import { daemonEnv } from "./daemon.js";

const opts = { port: 1, adminDir: "/a", nextBin: "/n" };

it("T1 hands down the package root beside the project root", () => {
	const env = daemonEnv({ ...opts, packageRoot: "/pkg", projectRoot: "/proj" }, { KEEP: "1" });
	expect(env[PACKAGE_ROOT_ENV]).toBe("/pkg");
	expect(env.INDUSK_PROJECT_ROOT).toBe("/proj");
	expect(env.KEEP).toBe("1");
});

it("T1 leaves the variable out when no root is passed, keeping an inherited one out too", () => {
	const env = daemonEnv(opts, { [PACKAGE_ROOT_ENV]: "/stale" });
	expect(env[PACKAGE_ROOT_ENV]).toBeUndefined();
});
