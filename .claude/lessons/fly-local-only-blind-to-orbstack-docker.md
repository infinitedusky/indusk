# `fly deploy --local-only` cannot see OrbStack's Docker daemon — push the built image to the app's own Fly registry instead

In `apps/indusk-mcp/src/lib/server/deploy.ts`, the `--build-from` path (an unreleased build deployed before any release has published the image — server-provisioning ADR, Build Phase 3 of `.indusk/planning/server-provisioning/impl.md`) first shipped at commit c6aa91a5 tagging the locally-built image `indusk-always-on-local:<version>` and passing `fly deploy --image <tag> --local-only`, relying on Fly's CLI to read the image straight from the local Docker daemon.

Running A8 (the live e2e check, `apps/indusk-mcp/e2e/server-live.e2e.test.ts`) for real on a machine using OrbStack found `--local-only` cannot see OrbStack's Docker daemon — Fly's CLI looks for a `docker` daemon through a path/socket OrbStack doesn't put itself on. The fix (not yet committed as of this eval, but present in the worktree): tag the image `registry.fly.io/<app>:<version>-local`, run `fly auth docker` then `docker push <tag>` after the app exists (so its registry does), and drop `--local-only` entirely — `fly deploy --image` then pulls from the app's own registry like any other deploy.

**Why**: Fly's documented `--local-only` behavior assumes Docker Desktop's standard socket; OrbStack is a drop-in replacement but not byte-identical on this specific integration path. This is a dependency on third-party CLI behavior outside this project's control — the same class of risk the plan's "Deferred Verification" section already names for Fly's CLI generally.

**How to apply**: when adding or debugging any `fly deploy` path that builds or references a local image, do not trust `--local-only` to work under OrbStack. Push to the app's own Fly registry (`registry.fly.io/<app>:<tag>`) and deploy via the normal `--image` flag instead. If using Docker Desktop specifically, `--local-only` may still be fine, but this project's dev machines use OrbStack.

