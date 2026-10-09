# The recording server (day-always-on; built this way since server-provisioning).
#
# The Jaeger InDusk already ships, run as a long-lived process: badger on a
# mounted volume, basic auth on the OTLP receiver and the query API, and an
# in-process pass that announces each violation to Slack once (or, with no
# webhook, records and announces nothing).
#
# Every release builds this image from its own packed tarball and publishes it
# as ghcr.io/infinitedusky/indusk-always-on:<version>, before npm has the
# version — so the image and the npm package of a release are the same bytes,
# and the build never waits on npm's publish-time scan. Run the published
# image; build this only for an unreleased version:
#
#   pnpm --filter @infinitedusky/indusk-mcp pack --pack-destination /tmp/ctx
#   docker build -f templates/server/Dockerfile --build-arg TARBALL=<file>.tgz /tmp/ctx
#
# What the server needs, and how to run it anywhere: /guide/run-your-own-server.
# Every setting comes from the environment and a missing one refuses by name.
# Nothing is baked in, and no credential belongs in this file.
#
# The repository's docker/Dockerfile.always-on is a copy of this file, pinned
# equal to it by always-on-image.test.ts.

FROM node:22-slim

ARG TARBALL

# The packed release. The telemetry binaries ship as platform-split
# optionalDependencies, resolved from npm for this platform at their own
# versions, so no separate download step exists to get wrong.
COPY ${TARBALL} /tmp/indusk.tgz
RUN npm install -g /tmp/indusk.tgz && rm /tmp/indusk.tgz

# Jaeger tries to export its own traces to localhost:4317 and logs a
# connection warning when nothing listens. Noise, not an error.
ENV INDUSK_SKIP_UPDATE_CHECK=1

# Foreground, as process 1: the supervisor that started this container is what
# restarts it. Nothing here daemonizes or writes a PID file.
ENTRYPOINT ["indusk", "telemetry", "serve"]
