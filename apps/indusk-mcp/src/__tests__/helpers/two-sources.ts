import { rmSync } from "node:fs";
import { type AlwaysOnServer, startAlwaysOnServer } from "./always-on-server.js";
import { type FixtureSpan, type LocalJaeger, startLocalJaeger } from "./local-jaeger.js";
import {
	daysAgo,
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "./promises-fixture.js";

/**
 * A project with two promise sources, both real (promise-sources).
 *
 * `local` is the local-telemetry daemon in a temporary `INDUSK_HOME`;
 * `production` is an always-on server the project names in `promises.jaeger`.
 * The two are loaded with different marks, so a reader that confuses them, or
 * reads only one, gives a wrong answer rather than a lucky right one.
 *
 * Throws when either cannot start: a fixture that degrades to one source
 * would let a one-source reader pass.
 */

export const CRED_ENV = "INDUSK_TEST_PRODUCTION_CREDENTIAL";
export const OWNER = "seats-v2";

export interface TwoSources {
	local: LocalJaeger;
	production: AlwaysOnServer;
	project: PromiseProject;
	/** Environment for a CLI run: the daemon's home and the server's credential. */
	env: NodeJS.ProcessEnv;
	stop: () => Promise<void>;
}

export interface TwoSourcesOptions {
	promises: string[];
	localMarks: FixtureSpan[];
	productionMarks: FixtureSpan[];
	/** `false` builds the same project without naming production (the one-source case). */
	nameProduction?: boolean;
}

export async function startTwoSources(opts: TwoSourcesOptions): Promise<TwoSources> {
	const local = await startLocalJaeger();
	let production: AlwaysOnServer;
	try {
		production = await startAlwaysOnServer();
	} catch (err) {
		local.stop();
		throw err;
	}
	const named = opts.nameProduction !== false;
	const project = promiseProject({
		domains: ["seating"],
		landed: { [OWNER]: daysAgo(30) },
		promises: opts.promises.map((name) => ({
			name,
			kind: "behaviour" as const,
			state: "enforced" as const,
			domain: "seating",
			owner: OWNER,
			sites: [`src/${name}.ts`],
			tests: [`src/${name}.test.ts`],
		})),
		files: Object.fromEntries(
			opts.promises.flatMap((n) => [
				[`src/${n}.ts`, siteFile(n)],
				[`src/${n}.test.ts`, testFile(n)],
			]),
		),
		...(named
			? {
					extraConfig: {
						promises: {
							domains: ["seating"],
							jaeger: {
								url: production.queryUrl,
								otlp_url: production.otlpUrl,
								credential_env: CRED_ENV,
							},
						},
					},
				}
			: {}),
	});
	if (opts.localMarks.length) await local.load(opts.localMarks);
	if (opts.productionMarks.length) await production.load(opts.productionMarks);

	return {
		local,
		production,
		project,
		env: { INDUSK_HOME: local.home, [CRED_ENV]: production.credential },
		stop: async () => {
			local.stop();
			await production.stop();
			rmSync(local.home, { recursive: true, force: true });
			rmSync(production.volume, { recursive: true, force: true });
			rmSync(project.root, { recursive: true, force: true });
		},
	};
}
