#!/usr/bin/env bash
# release-image.sh — build the recording server's image from this release's own
# tarball and publish it, before npm has the version (server-provisioning A18).
#
# Runs inside `pnpm release`, after `npm whoami` and before `pnpm publish`,
# joined by `&&`: a push the registry refuses stops the release with nothing on
# npm, so a version never exists on npm without its server image.
#
# Built from `pnpm pack`, not from npm: npm does not serve a version for five
# to fifteen minutes after publishing, so the release could not build its own
# image from it.
#
#   INDUSK_IMAGE       image name (default ghcr.io/infinitedusky/indusk-always-on)
#   INDUSK_IMAGE_PUSH  0 builds without pushing — the system-tier test (A19) does
#
# The first push needs `docker login ghcr.io` with a token that can write
# packages; a refusal says so.
set -euo pipefail

cd "$(dirname "$0")/.."
IMAGE="${INDUSK_IMAGE:-ghcr.io/infinitedusky/indusk-always-on}"
VERSION="$(node -p 'require("./package.json").version')"
CTX="$(mktemp -d)"
trap 'rm -rf "$CTX"' EXIT

echo "release-image: packing ${VERSION} …"
pnpm run --silent build
pnpm pack --pack-destination "$CTX" >/dev/null
TARBALL="$(cd "$CTX" && ls ./*.tgz | head -1 | sed 's#^\./##')"

echo "release-image: building ${IMAGE}:${VERSION} from ${TARBALL} …"
docker build -q -f templates/server/Dockerfile --build-arg "TARBALL=${TARBALL}" \
	-t "${IMAGE}:${VERSION}" -t "${IMAGE}:latest" "$CTX" >/dev/null

if [ "${INDUSK_IMAGE_PUSH:-1}" = "0" ]; then
	echo "release-image: built ${IMAGE}:${VERSION}; not pushed (INDUSK_IMAGE_PUSH=0)."
	exit 0
fi

echo "release-image: pushing ${IMAGE}:${VERSION} and :latest …"
if ! docker push "${IMAGE}:${VERSION}"; then
	echo "release-image: the push of ${IMAGE}:${VERSION} was refused. If the registry asked for a login, run \`docker login ghcr.io\` with a token that can write packages, then run the release again. Nothing was published to npm." >&2
	exit 1
fi
docker push "${IMAGE}:latest"
