import { PublishRefusal, publishPaper } from "../../lib/papers/publish.js";

export interface PapersPublishOptions {
	to?: string;
	push?: boolean;
}

/**
 * `indusk papers publish <plan>/<file> [--to <name>] [--push]`.
 *
 * Exit 1 with the refusal on stderr; exit 0 with the destination and commits
 * on stdout. An up-to-date paper is exit 0 and says so — nothing to do is a
 * result, not a failure.
 */
export async function papersPublish(
	projectRoot: string,
	target: string,
	opts: PapersPublishOptions = {},
): Promise<void> {
	const slash = target.indexOf("/");
	if (slash <= 0 || slash === target.length - 1) {
		console.error(`Expected <plan>/<file>, got "${target}".`);
		process.exitCode = 1;
		return;
	}
	const plan = target.slice(0, slash);
	const file = target.slice(slash + 1);

	try {
		const result = await publishPaper({
			projectRoot,
			plan,
			file,
			destination: opts.to,
			push: opts.push,
		});
		for (const warning of result.warnings) console.error(`warning: ${warning}`);
		if (result.kind === "up-to-date") {
			console.info(
				`${plan}/${file} is up to date at ${result.destination}:${result.page}; no changes.`,
			);
			return;
		}
		console.info(`Published ${plan}/${file} to ${result.destination}:${result.page}`);
		console.info(
			`  destination commit ${result.destinationCommit}${result.diverged ? " (the page had diverged; overwritten from the plan copy)" : ""}`,
		);
		console.info(`  source commit ${result.sourceCommit}; provenance written back and committed`);
		if (result.pushError !== undefined) {
			console.error(
				`warning: push failed; the publish is complete and committed, push it yourself: ${result.pushError}`,
			);
		} else {
			console.info(
				opts.push ? "  pushed" : "  not pushed: push the destination yourself, or pass --push",
			);
		}
	} catch (err) {
		if (err instanceof PublishRefusal) {
			console.error(err.message);
			process.exitCode = 1;
			return;
		}
		throw err;
	}
}
