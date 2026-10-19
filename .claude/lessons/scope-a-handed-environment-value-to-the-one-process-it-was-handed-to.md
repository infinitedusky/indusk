# Scope an environment value one process hands to another to that one process, never to every child it spawns

A value handed through the environment (for example INDUSK_MCP_PACKAGE_ROOT) is inherited by every child process by default. In the-admin-knows-the-package-root a stale root from one install answered for another because the children inherited it. The impl's Note called inheritance "intended"; falsification overturned that.

**How to apply:** set the value only in the environment of the single spawn it is for, and clear or omit it for every other child. When a plan's design says "inheritance is intended", ask which child could receive a value from a different install and test that case.

Source: highlight h-20261019-007 (retro-lesson), plan the-admin-knows-the-package-root.
