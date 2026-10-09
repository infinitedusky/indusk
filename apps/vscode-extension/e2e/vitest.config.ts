import { defineConfig } from "vitest/config";

// Live checks, run by hand with INDUSK_LIVE_EDITOR=1 (vscode-extension Build Phase 4).
export default defineConfig({ test: { include: ["e2e/**/*.e2e.test.ts"], testTimeout: 300_000 } });
