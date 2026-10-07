import { defineConfig } from "vitest/config";

// The example's own config, so it runs the same inside the InDusk monorepo and
// once copied out on its own.
export default defineConfig({
	test: { include: ["src/**/*.test.ts"] },
});
