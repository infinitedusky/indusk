import { ADMIN_HOSTNAME } from "../admin/proxy-route.js";

/**
 * The hosts the admin answers on (admin-plan-authoring A34). The daemon
 * listens on the loopback address, but a page on another site can still
 * reach it by DNS rebinding: its own name, pointed at 127.0.0.1, so its
 * `Origin` and the request's `Host` both name that site and agree. Its routes
 * start the developer's `claude`, stream what it says and accept plans, so
 * the `Host` must be one of the admin's own names: the loopback address,
 * `localhost`, or the hostname the admin's proxy route gives it. Any port —
 * the port is the daemon's to choose, and loopback is local whatever it is.
 *
 * promise: nothing-ships-until-accepted
 */

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]", ADMIN_HOSTNAME]);

export function isAdminHost(host: string | null): boolean {
	if (!host) return false;
	try {
		return LOOPBACK.has(new URL(`http://${host}`).hostname.toLowerCase());
	} catch {
		return false;
	}
}
