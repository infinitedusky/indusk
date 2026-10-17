// clause: a regression guard over everyday-tests-never-wait
// promise: the-daemon-readers-follow-is-the-one-running
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// the guard script's own copy, loaded without a build
import { daemonProcessOf as scriptParse } from "../../scripts/check-test-daemons.js";
import { daemonProcessOf, homeKind } from "../lib/telemetry/daemon-process.js";

/**
 * A26 — the package and the test-daemon guard script recognise a daemon
 * process the same way, and a home under a temporary root is temporary while
 * `~/.indusk` is real. (The stored-address half, that a temporary home never
 * reads or writes the real home's address, joins in Build Phase 3 with
 * `startPlan`.)
 *
 * The script runs without a build, so it carries its own copy of the parser;
 * this file is what keeps the two equal.
 */

const BIN = "/x/node_modules/@infinitedusky/telemetry-binaries-darwin-arm64/bin";
const COMMAND_LINES = [
	`${BIN}/jaeger --config=file:/Users/a/.indusk/telemetry-jaeger.yaml`,
	`${BIN}/otelcol --config=/Users/a/.indusk/telemetry-collector.yaml`,
	`/bin/sh ${BIN}/otelcol --config=/tmp/h-1/live.yaml`,
	`${BIN}/jaeger`,
	"/usr/bin/vim telemetry-jaeger.yaml",
	"node /somewhere/jaeger-ui/server.js --config=/Users/a/.indusk/telemetry-jaeger.yaml",
	"",
];
const TEMP_ROOTS = ["/tmp", "/private/tmp", "/private/var/folders/x/T", "/var/folders/x/T"];

describe("A26 — one way to recognise an InDusk daemon process", () => {
	it.each(COMMAND_LINES)("the package and the guard script agree on %j", (cmd) => {
		expect(scriptParse(cmd)).toEqual(daemonProcessOf(cmd));
	});

	it("reads role, binary and the home out of the config path", () => {
		expect(daemonProcessOf(COMMAND_LINES[0])).toEqual({
			role: "jaeger",
			binary: `${BIN}/jaeger`,
			configPath: "/Users/a/.indusk/telemetry-jaeger.yaml",
			home: "/Users/a/.indusk",
		});
		expect(daemonProcessOf(COMMAND_LINES[1])?.home).toBe("/Users/a/.indusk");
	});

	it("a command line without InDusk's binary and a config is nobody's daemon", () => {
		expect(daemonProcessOf(COMMAND_LINES[3])).toBeNull();
		expect(daemonProcessOf(COMMAND_LINES[4])).toBeNull();
		expect(daemonProcessOf(COMMAND_LINES[5])).toBeNull();
	});

	it("a home under a temp root is temporary, ~/.indusk is real", () => {
		expect(homeKind("/private/var/folders/x/T/h-1", TEMP_ROOTS)).toBe("temporary");
		expect(homeKind("/tmp/h-1", TEMP_ROOTS)).toBe("temporary");
		expect(homeKind(join(homedir(), ".indusk"), TEMP_ROOTS)).toBe("real");
		expect(homeKind("/tmp", TEMP_ROOTS), "the root itself is not under it").toBe("real");
	});
});
