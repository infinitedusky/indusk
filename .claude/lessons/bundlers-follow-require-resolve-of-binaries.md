# Keep modules that resolve or spawn binaries out of any import graph a bundled web app reads

Next.js's Turbopack follows `createRequire(import.meta.url).resolve("pkg/bin/<binary>")` and tries to parse the resolved native binary as source ("invalid utf-8 sequence"), failing every page that imports the module transitively. In day-monitor the admin imported a read-only telemetry query, which imported the daemon module, which resolved the Jaeger binary — and every project page returned 500.

Do: split the read side (status files, identity checks, endpoints) into its own module that resolves and spawns nothing, have the lifecycle module re-export it so existing importers are unchanged, and point every reader — especially anything a web app bundles — at the read module. Verify by booting the app, not by type-checking: `tsc` is clean either way.
