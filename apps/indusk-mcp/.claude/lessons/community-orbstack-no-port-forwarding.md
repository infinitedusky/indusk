# Don't forward ports to localhost — use OrbStack hostnames

InDusk projects assume OrbStack. Every Docker container gets a DNS hostname at `{service}-{profile}.{project}.orb.local`. This means:

- **Don't add `ports:` mappings in Docker contracts.** Port forwarding to localhost causes collisions between services that use the same default port (two FalkorDB instances both wanting 6379, for example).
- **Reference services by OrbStack hostname**, not `localhost:PORT`. Use `falkordb-local.myproject.orb.local:6379` not `localhost:6379`.
- **composable.env components should use `${networking.DOMAIN}` and `${networking.PROFILE_SUFFIX}`** to build hostnames that resolve correctly per profile.

The code graph's FalkorDB is a single global Docker container shared across all projects. It does NOT forward ports to localhost. CGC connects to it via `falkordb.orb.local:6379`. Each project uses a different `FALKORDB_GRAPH_NAME` for isolation. This container is created once by `indusk-mcp init` and auto-starts with OrbStack.

What goes wrong if you ignore this: two services claim the same localhost port, one fails to start, you spend 30 minutes debugging a port collision that shouldn't exist.
