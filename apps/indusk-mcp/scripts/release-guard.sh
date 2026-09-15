#!/usr/bin/env bash
# release-guard.sh — refuse to publish a version the working tree has moved past.
#
# Why this exists: on 2026-09-15 a bump to 1.44.1 was committed mid-plan, the
# close-out rituals then found four more defects, and 27 commits of real work
# landed on main under a version number that had already been published. The
# publish was correct when it was made; the work behind it was not accounted
# for. `--no-git-checks` is what let that happen silently.
#
# Two refusals, both about the same fact — the thing being published must be
# the thing the release commit named:
#
#   1. The working tree is dirty, so the tarball would not match any commit.
#   2. HEAD is not the release commit for this version, which means either the
#      bump was never committed or work landed after it.
#
# Neither is a judgement about whether the work is good. They are both "the
# number you are about to publish does not describe the tree you are
# publishing", which is the only thing a version number promises.

set -euo pipefail

PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(git -C "$PKG_DIR" rev-parse --show-toplevel)"
VERSION="$(node -p "require('$PKG_DIR/package.json').version")"

fail() {
	echo "" >&2
	echo "Refusing to publish $VERSION." >&2
	echo "" >&2
	printf '%s\n' "$@" >&2
	echo "" >&2
	echo "Override deliberately with: SKIP_RELEASE_GUARD=1 pnpm release" >&2
	exit 1
}

if [[ "${SKIP_RELEASE_GUARD:-}" == "1" ]]; then
	echo "release-guard: skipped by SKIP_RELEASE_GUARD=1"
	exit 0
fi

# 1. A dirty tree publishes something no commit describes.
if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
	fail "The working tree has uncommitted changes, so the tarball would not" \
		"match any commit. Commit or stash them first:" \
		"" \
		"$(git -C "$REPO_ROOT" status --short | head -10)"
fi

# 2. HEAD must be the release commit for this exact version.
#
# Matched on the message rather than a tag because this repo's convention is
# `chore(release): <version> — <summary>` and has been for every release; a tag
# scheme would have to be introduced and backfilled to be usable here.
RELEASE_COMMIT="$(git -C "$REPO_ROOT" log --format=%H --grep="^chore(release): ${VERSION}\b" -1 || true)"

if [[ -z "$RELEASE_COMMIT" ]]; then
	fail "No commit names this version. The convention is a final commit reading" \
		"  chore(release): ${VERSION} — <what shipped>" \
		"and the bump belongs in it. Bump, commit, then publish."
fi

HEAD_COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD)"
if [[ "$RELEASE_COMMIT" != "$HEAD_COMMIT" ]]; then
	AHEAD="$(git -C "$REPO_ROOT" rev-list --count "${RELEASE_COMMIT}..HEAD")"
	fail "HEAD is ${AHEAD} commit(s) past the release commit for ${VERSION}, so this" \
		"tarball would ship a version number that does not describe the tree." \
		"" \
		"  release commit: $(git -C "$REPO_ROOT" log -1 --format='%h %s' "$RELEASE_COMMIT")" \
		"  HEAD:           $(git -C "$REPO_ROOT" log -1 --format='%h %s' "$HEAD_COMMIT")" \
		"" \
		"Unpublished work:" \
		"$(git -C "$REPO_ROOT" log --oneline "${RELEASE_COMMIT}..HEAD" | head -10)" \
		"" \
		"Bump again for the work above, then publish that commit."
fi

echo "release-guard: HEAD is the release commit for ${VERSION} — ok"
