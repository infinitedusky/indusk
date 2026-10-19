# A bug that only the bundler causes is proved fixed in the built artifact, so its promise carries a live check

In the-admin-knows-the-package-root the bug came from Turbopack rewriting `import.meta.url`. Unit rows over the source cannot see a rewrite the bundler makes, so the rows proved the lookup logic and not the outcome. The earlier assumption that unit rows of the lookup were enough was wrong.

**How to apply:** when a promise depends on a path, URL or module identity at runtime in a bundled app (`import.meta.url`, `require.resolve`, `__dirname`), add a live check run against the built artifact (built admin, `indusk ui restart`) and make it part of the promise, not only a unit row. If the check must wait for landing, record it as a deferred live check with its procedure.

Source: highlight h-20261019-008 (retro-lesson), plan the-admin-knows-the-package-root. See also bundlers-follow-require-resolve-of-binaries.
