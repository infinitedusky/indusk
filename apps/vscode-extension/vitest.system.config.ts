import { defineConfig } from "vitest/config";

// The system tier: tests that start VS Code. Run at landing and release, never in the everyday suite.
export default defineConfig({
	test: { include: ["src/__tests__/**/*.test.ts"], testTimeout: 300_000, hookTimeout: 600_000 },
});
