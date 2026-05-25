import { describe, expect, it } from "vitest";
import { detectGlobalManagerFromPath, installCommandFor } from "./global-install-manager.js";

describe("detectGlobalManagerFromPath", () => {
	it("classifies pnpm-installed binaries", () => {
		// macOS pnpm
		expect(detectGlobalManagerFromPath("/Users/the_dusky/Library/pnpm/indusk")).toBe("pnpm");
		// Linux pnpm
		expect(detectGlobalManagerFromPath("/home/user/.local/share/pnpm/indusk")).toBe("pnpm");
		// Windows-ish (forward-slash normalized)
		expect(detectGlobalManagerFromPath("C:\\Users\\u\\AppData\\Local\\pnpm\\indusk.cmd")).toBe(
			"pnpm",
		);
	});

	it("classifies bun-installed binaries", () => {
		expect(detectGlobalManagerFromPath("/Users/u/.bun/bin/indusk")).toBe("bun");
	});

	it("falls back to npm for homebrew, nvm, and node_modules/.bin locations", () => {
		expect(detectGlobalManagerFromPath("/opt/homebrew/bin/indusk")).toBe("npm");
		expect(detectGlobalManagerFromPath("/Users/u/.nvm/versions/node/v22.17.0/bin/indusk")).toBe(
			"npm",
		);
		expect(detectGlobalManagerFromPath("/Users/u/project/node_modules/.bin/indusk")).toBe("npm");
	});

	it("returns null for empty or absent paths", () => {
		expect(detectGlobalManagerFromPath(null)).toBeNull();
		expect(detectGlobalManagerFromPath(undefined)).toBeNull();
		expect(detectGlobalManagerFromPath("")).toBeNull();
	});

	it("disambiguates pnpm from a stray 'pnpm' substring elsewhere", () => {
		// Path contains 'pnpm' only inside a segment name (still pnpm-owned).
		expect(detectGlobalManagerFromPath("/var/lib/pnpm/store/indusk")).toBe("pnpm");
		// A package named 'something-pnpm-like' inside node_modules is NOT pnpm-owned.
		// (We require '/pnpm/' as a path segment, not just substring "pnpm".)
		expect(detectGlobalManagerFromPath("/usr/lib/node_modules/pnpmless-pkg/bin/x")).toBe("npm");
	});
});

describe("installCommandFor", () => {
	it("builds pnpm add -g", () => {
		expect(installCommandFor("pnpm", "1.28.19")).toBe(
			"pnpm add -g @infinitedusky/indusk-mcp@1.28.19",
		);
	});

	it("builds bun install -g", () => {
		expect(installCommandFor("bun", "1.28.19")).toBe(
			"bun install -g @infinitedusky/indusk-mcp@1.28.19",
		);
	});

	it("builds npm i -g", () => {
		expect(installCommandFor("npm", "1.28.19")).toBe("npm i -g @infinitedusky/indusk-mcp@1.28.19");
	});

	it("supports the 'latest' tag for --force upgrades", () => {
		expect(installCommandFor("pnpm", "latest")).toBe(
			"pnpm add -g @infinitedusky/indusk-mcp@latest",
		);
	});
});
