import { configDefaults, defineConfig } from "vitest/config";
import { RUN_ALONE, SYSTEM } from "./vitest.tiers";

/**
 * The system tier (`pnpm test:system`): the files that start a real daemon,
 * server or packed tarball. In parallel, except RUN_ALONE, which runs after
 * the rest, one file at a time. See `vitest.tiers.ts` for why.
 */
export default defineConfig({
	test: {
		passWithNoTests: false,
		projects: [
			{
				test: {
					name: "system",
					include: SYSTEM.filter((f) => !RUN_ALONE.includes(f)),
					exclude: [...configDefaults.exclude],
					sequence: { groupOrder: 0 },
				},
			},
			{
				test: {
					name: "system:alone",
					include: RUN_ALONE,
					fileParallelism: false,
					sequence: { groupOrder: 1 },
				},
			},
		],
	},
});
