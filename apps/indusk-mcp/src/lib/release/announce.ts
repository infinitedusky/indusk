import { bookkeepingRoots } from "../bookkeeping/roots.js";
import { appendInbox } from "../promises/inbox.js";
import { commitRecorded } from "../promises/record-commit.js";
import { maintenanceHeadingName } from "../promises/reopen.js";
import type { RoutedIncident } from "./settle.js";

/**
 * What a release does with an incident it opened or extended, as the recorder
 * does with a watcher's (release-records-its-failures A23, incident-recording
 * D5): tell the project's inbox, so a running agent hears it on its next
 * prompt, then commit it on the trunk through the recorder's own commit path.
 * The inbox never waits on the commit; a commit that cannot be made (not on a
 * trunk branch) throws with the reason, after the agent has been told.
 *
 * promise: a-break-reaches-the-working-agent
 */
export async function announceIncidents(
	root: string,
	incidents: RoutedIncident[],
	now: Date,
): Promise<string[]> {
	if (incidents.length === 0) return [];
	const { home } = bookkeepingRoots(root);
	appendInbox(
		home,
		incidents.map((i) => ({
			kind: "break",
			promise: i.promise,
			incident: i.id,
			owner: i.owner,
			phase: maintenanceHeadingName(i.id),
		})),
		now,
	);
	return commitRecorded(root, home, incidents, "release");
}
