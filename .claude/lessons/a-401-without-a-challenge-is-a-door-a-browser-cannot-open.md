# A 401 without a challenge is a door a browser cannot open — anything a person will click must send WWW-Authenticate

The always-on server protected its query API with Jaeger's basic auth, the OpenTelemetry Collector's `basicauth` extension. That extension refuses with a bare 401 and no `WWW-Authenticate` header. Every program that read the server sent its credentials up front and never noticed. A person clicking the trace link from Slack got "no basic auth provided": a browser shows a login box only when the 401 carries a challenge.

Why it matters: "protected by basic auth" was tested by programs, which is the one kind of client that cannot see this gap. The first person to click a link found it.

What to do: when a URL is meant for a person, test it the way a browser meets it. An unauthenticated request must come back 401 with `WWW-Authenticate: Basic`. Here the server's own process answers the public query port and adds the challenge to Jaeger's refusals (`lib/telemetry/query-door.ts`). Jaeger stays the only thing that checks a password. Guarded by `always-on-browser-login.test.ts` (A12).
