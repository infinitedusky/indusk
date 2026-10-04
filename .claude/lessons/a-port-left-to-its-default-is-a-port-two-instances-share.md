# A port left to its default is a port two instances share — set every port a server binds, and bind what nobody outside needs to loopback

The always-on server's config set the OTLP and query ports from its settings and left Jaeger's gRPC query port unset. Jaeger bound its default, 0.0.0.0:16685, so:

- a second server on the same host could not start;
- every always-on test file had to run alone;
- the gRPC query API listened on every interface with none of the basic auth the two declared doors carry.

Why it matters: a default you never wrote is a decision you never made. It collides the moment two instances share a host, and it opens a door the security review of the declared ports never looked at.

What to do: render every listener a server starts from its own settings, including the ones you do not use. Bind any listener nobody outside the process needs to 127.0.0.1. Test it by starting two instances at once (`always-on-two-servers.test.ts`, A8), which fails on the first port you forgot.
