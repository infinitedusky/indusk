import { defineConfig } from "vitest/config";

export default defineConfig({
	extends: true,
	test: {
		include: ["**/*.test.{ts,tsx}"],
		passWithNoTests: true,
	},
});
