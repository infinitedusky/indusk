import { defineConfig } from "vitest/config";

// The core is pure: these tests never start VS Code.
export default defineConfig({
	test: { include: ["src/**/*.test.ts"], exclude: ["src/__tests__/**"] },
});
