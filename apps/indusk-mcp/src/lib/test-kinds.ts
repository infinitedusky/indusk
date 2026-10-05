/**
 * The names 1.61.0 published under `./test-kinds`, kept so that an import of
 * them still resolves. The definition is `./test-levels.ts`: a test has a
 * level, a promise has a kind (planner-promises ADR D7).
 */
export {
	isTestLevel as isTestKind,
	levelsList as kindsList,
	TEST_LEVEL_MOMENTS as TEST_KIND_MOMENTS,
	TEST_LEVELS as TEST_KINDS,
	type TestLevel as TestKind,
} from "./test-levels.js";
