import { defineConfig } from "vitest/config";

// Times show in the machine's own zone; the tests pin it so they read the same
// everywhere. A test that cares about a zone passes one explicitly.
process.env.TZ = "UTC";

// The core is pure: these tests never start VS Code.
export default defineConfig({
	test: { include: ["src/**/*.test.ts"], exclude: ["src/__tests__/**"] },
});
