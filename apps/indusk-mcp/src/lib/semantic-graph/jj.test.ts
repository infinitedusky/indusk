import { afterEach, describe, expect, it } from "vitest";

import {
	getCurrentChangeId,
	getReachableChangeIds,
	isChangeReachable,
	NotAJjRepoError,
	resetJjRunner,
	setJjRunner,
} from "./jj.js";

afterEach(() => {
	resetJjRunner();
});

describe("getCurrentChangeId", () => {
	it("returns the trimmed change id from jj log -r @", async () => {
		setJjRunner(async (args) => {
			expect(args).toEqual(["log", "-r", "@", "--no-graph", "--template", "change_id"]);
			return "lrowmounwpxnmortzuyumsomuprkrspv";
		});
		const id = await getCurrentChangeId("/fake/cwd");
		expect(id).toBe("lrowmounwpxnmortzuyumsomuprkrspv");
	});

	it("trims trailing whitespace from jj output", async () => {
		setJjRunner(async () => "lrowmounwpxnmortzuyumsomuprkrspv\n");
		const id = await getCurrentChangeId("/fake/cwd");
		expect(id).toBe("lrowmounwpxnmortzuyumsomuprkrspv");
	});

	it("throws on empty output", async () => {
		setJjRunner(async () => "");
		await expect(getCurrentChangeId("/fake/cwd")).rejects.toThrow(/Invalid jj change id/);
	});

	it("throws on non-letter output (malformed jj response)", async () => {
		setJjRunner(async () => "abc123");
		await expect(getCurrentChangeId("/fake/cwd")).rejects.toThrow(/Invalid jj change id/);
	});

	it("propagates NotAJjRepoError when the runner throws it", async () => {
		setJjRunner(async () => {
			throw new NotAJjRepoError("/fake/cwd");
		});
		await expect(getCurrentChangeId("/fake/cwd")).rejects.toBeInstanceOf(NotAJjRepoError);
	});
});

describe("getReachableChangeIds", () => {
	it("parses a multi-line ancestry list into a set", async () => {
		setJjRunner(async (args) => {
			expect(args).toEqual(["log", "-r", "::@", "--no-graph", "--template", 'change_id ++ "\n"']);
			return [
				"lrowmounwpxnmortzuyumsomuprkrspv",
				"ulqxwpkwwyppkvxxqqzrkqmpoqxuztwk",
				"nyrvtuspustmtmkxpkzsyoptrswsmusv",
				"",
			].join("\n");
		});

		const set = await getReachableChangeIds("/fake/cwd");
		expect(set.size).toBe(3);
		expect(set.has("lrowmounwpxnmortzuyumsomuprkrspv")).toBe(true);
		expect(set.has("ulqxwpkwwyppkvxxqqzrkqmpoqxuztwk")).toBe(true);
		expect(set.has("nyrvtuspustmtmkxpkzsyoptrswsmusv")).toBe(true);
	});

	it("deduplicates repeated change ids", async () => {
		setJjRunner(async () => ["aaa", "bbb", "aaa"].join("\n"));
		const set = await getReachableChangeIds("/fake/cwd");
		expect(set.size).toBe(2);
	});

	it("throws if the ancestry query returns no change ids", async () => {
		setJjRunner(async () => "\n\n");
		await expect(getReachableChangeIds("/fake/cwd")).rejects.toThrow(/empty repo/);
	});

	it("throws NotAJjRepoError when runner reports it", async () => {
		setJjRunner(async () => {
			throw new NotAJjRepoError("/fake/cwd");
		});
		await expect(getReachableChangeIds("/fake/cwd")).rejects.toBeInstanceOf(NotAJjRepoError);
	});
});

describe("isChangeReachable", () => {
	it("returns true for change IDs in the set", () => {
		const set = new Set(["aaa", "bbb", "ccc"]);
		expect(isChangeReachable("bbb", set)).toBe(true);
	});

	it("returns false for change IDs not in the set", () => {
		const set = new Set(["aaa", "bbb"]);
		expect(isChangeReachable("ccc", set)).toBe(false);
	});
});
