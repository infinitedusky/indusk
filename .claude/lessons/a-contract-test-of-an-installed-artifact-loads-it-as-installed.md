# A contract test of an installed artifact must load it as installed, not in development mode

A contract test for something users install must load it the way users get it, not in a development mode that needed other settings to disable the rest of the environment.

**Why:** the vscode-extension's A16 proved activation only under `extensionDevelopmentPath` with `--disable-extensions`, which is not the path `indusk editor install` produces. Sandy (2026-10-09) asked "are you actually testing what you want to test?" and the answer was no. A test can be green while asserting something other than the promise.

**How to apply:** point the host at the installed artifact's real location (for VS Code, a temporary `--extensions-dir` holding the installed extension), do not pass flags that disable the rest of the environment, and assert from the host's log that the artifact was not loaded as a development extension. If a probe is needed, make the probe the development extension, not ours.

See `.indusk/planning/system-tests-catch-up/impl.md`, trajectory row A5.
