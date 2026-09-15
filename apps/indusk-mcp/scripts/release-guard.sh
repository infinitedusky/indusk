#!/usr/bin/env bash
# release-guard.sh — refuse to publish a version the working tree has moved past.
#
# Why this exists: on 2026-09-15 a bump to 1.44.1 was committed mid-plan, the
# close-out rituals then found four more defects, and 27 commits of real work
# landed on main under a version number that had already been published. The
# publish was correct when it was made; the work behind it was not accounted
# for. `--no-git-checks` is what let that happen silently.
#
# `pnpm publish` packs the WORKING TREE, not a commit — verified against the
# published 1.44.1 tarball, whose files matched main exactly, including changes
# made after the bump. So the question is never "was the bump recent enough".
# It is always "does this tree contain the finished work".
#
# That makes worktree-per-plan the real hazard: every plan runs on a `plan/*`
# branch in its own worktree, so a publish from a perfectly clean main is blind
# to it by construction. On 2026-09-15 a publish went out 56 seconds before a
# twelve-commit plan branch merged; nothing about main looked wrong.
#
# Three refusals, one fact — the tree being published must be the finished work:
#
#   1. The working tree is dirty, so the tarball matches no commit.
#   2. HEAD is not the release commit, so the number does not describe the tree.
#   3. An unmerged `plan/*` branch carries commits touching PACKAGED paths, so
#      finished work may be missing from the tarball. Branches that only touch
#      planning documents cannot change it and are reported, not refused.
#
# None is a judgement about whether the work is good. The rule they enforce is
# "bump on main, after the branch is merged" — the simplest form of the same
# thing.

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

# 3. Unmerged plan branches that could change the tarball.
#
# Packaged paths come from package.json `files` (dist is built from src). A
# branch touching only `.indusk/planning/` cannot alter what ships, so it is
# named rather than refused — refusing on every in-flight plan would make the
# guard something people route around.
PACKAGED_PATHS=(
	"apps/indusk-mcp/src"
	"apps/indusk-mcp/skills"
	"apps/indusk-mcp/templates"
	"apps/indusk-mcp/hooks"
	"apps/indusk-mcp/lessons"
	"apps/indusk-mcp/extensions"
	"apps/indusk-mcp/package.json"
	"apps/indusk-admin"
)

BLOCKING=""
INFORMATIONAL=""
while IFS= read -r branch; do
	[[ -z "$branch" ]] && continue
	count="$(git -C "$REPO_ROOT" rev-list --count "HEAD..${branch}")"
	[[ "$count" == "0" ]] && continue
	touched="$(git -C "$REPO_ROOT" diff --name-only "HEAD...${branch}" -- "${PACKAGED_PATHS[@]}" | head -5)"
	if [[ -n "$touched" ]]; then
		BLOCKING+="  ${branch} — ${count} commit(s), touches packaged files:"$'\n'
		while IFS= read -r f; do BLOCKING+="      ${f}"$'\n'; done <<< "$touched"
	else
		INFORMATIONAL+="  ${branch} — ${count} commit(s), planning documents only"$'\n'
	fi
done < <(git -C "$REPO_ROOT" for-each-ref --format='%(refname:short)' 'refs/heads/plan/*' --no-merged HEAD)

if [[ -n "$BLOCKING" ]]; then
	fail "Unmerged plan branch(es) carry work that would change this tarball:" \
		"" \
		"${BLOCKING}" \
		"Publishing packs the working tree, so this release would ship without them." \
		"Merge the branch, bump on main, then publish that commit."
fi

if [[ -n "$INFORMATIONAL" ]]; then
	echo "release-guard: unmerged plan branch(es), planning documents only — not blocking:"
	printf '%s' "$INFORMATIONAL"
fi

echo "release-guard: HEAD is the release commit for ${VERSION}, tree clean, no unmerged packaged work — ok"
