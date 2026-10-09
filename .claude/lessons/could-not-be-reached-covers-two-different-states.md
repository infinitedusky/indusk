# "Could not be reached" can mean two different things — not up yet (wait) or up and refusing the login (don't wait, fix the credential)

A retry loop that treats every connection failure as "the server hasn't started yet" will retry a wrong-credential rejection (e.g. HTTP 401/403) for its full timeout, then give advice that repeats the same failure (e.g. "run the same command again" when the stored credential is what's rejected).

Why: server-provisioning's A24 found this exactly — `connectWhenReachable` waited up to five minutes on a 401 before server-provisioning fixed it, because "the request failed" and "the server isn't listening yet" produced the same exception type. The fix distinguished "up, refused the login" (detected by matching "answered 401/403" in the error) from "not up yet" (connection refused / timeout), and only retried the latter — plus it changed the failure's advice from "run again" to "run with --rotate" when a stored credential was the one rejected.

How to apply: when building a wait-for-ready / retry loop around a remote service, don't let "any error" collapse into one retry branch. If the failure carries a status code or distinguishable reason, split "transient, worth waiting on" from "the service answered and said no" — and make the error message tell the person what the second case actually needs (a new credential, a different flag), not just "try again".

See: server-provisioning retrospective, `.indusk/planning/archive/server-provisioning/retrospective.md`; `apps/indusk-mcp/src/lib/server/deploy.ts`'s `connectWhenReachable`.
