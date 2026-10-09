/**
 * One Slack message; throws when Slack does not accept it. The always-on
 * server's announcements and heartbeat, and the laptop's reminders
 * (incident-recording), all post through it.
 */
export async function postToSlack(webhook: string, text: string, timeoutMs: number): Promise<void> {
	const res = await fetch(webhook, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ text }),
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!res.ok) throw new Error(`Slack answered ${res.status}`);
}
