import { describe, expect, it } from "vitest";
import { githubAccount } from "./github.js";

// promise: a-remote-repository-says-whose-and-who-can-see-it

const two = `github.com
  ✓ Logged in to github.com account other (keyring)
  - Active account: false
  - Git operations protocol: https

  ✓ Logged in to github.com account infinitedusky (keyring)
  - Active account: true
  - Git operations protocol: https
`;

describe("githubAccount", () => {
	it("names the account gh reports as active", async () => {
		expect(await githubAccount(async () => two)).toBe("infinitedusky");
	});

	it("takes the only account of a gh that prints no Active account line", async () => {
		const old = "github.com\n  ✓ Logged in to github.com account solo (keyring)\n";
		expect(await githubAccount(async () => old)).toBe("solo");
	});

	it("is null when nobody is signed in", async () => {
		const out = "You are not logged into any GitHub hosts. To log in, run: gh auth login\n";
		expect(await githubAccount(async () => out)).toBeNull();
	});

	it("is null when gh is not installed", async () => {
		expect(await githubAccount(async () => null)).toBeNull();
	});

	it("is null when accounts are saved but none is active", async () => {
		const out = "  ✓ Logged in to github.com account a (keyring)\n  - Active account: false\n";
		expect(await githubAccount(async () => out)).toBeNull();
	});

	it("asks gh for its auth status and nothing else", async () => {
		const asked: string[][] = [];
		await githubAccount(async (args) => {
			asked.push(args);
			return null;
		});
		expect(asked).toEqual([["auth", "status"]]);
	});
});
