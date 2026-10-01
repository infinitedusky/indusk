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
#   1. A PACKAGED path is dirty, so the tarball matches no commit. Uncommitted
#      plan documents, docs pages or another session's in-flight folders
#      cannot reach the tarball and are ignored — a guard that refuses on
#      unrelated dirt is one people override, which is how 2026-09-17's
#      release was nearly published with SKIP_RELEASE_GUARD=1 over two
#      planning folders that belonged to a different live session.
#   2. HEAD is not the release commit, so the number does not describe the tree.
#   3. An unmerged `plan/*` branch carries commits touching PACKAGED paths, so
#      finished work may be missing from the tarball. Branches that only touch
#      planning documents cannot change it and are reported, not refused.
#   4. This version is already on the registry. npm would reject it anyway with
#      a 403, but only after `whoami` and a pack — this says it first, in the
#      vocabulary of the other refusals, and names the next free number.
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

# What actually reaches the tarball, from package.json `files` (dist is built
# from src). Shared by checks 1, 2 and 3: all three ask the same question —
# could this change what ships? Note `scripts/` is absent except the bundler,
# so this guard's own source cannot alter a release.
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

# 1. A dirty packaged path publishes something no commit describes.
#
# Scoped to PACKAGED_PATHS, like checks 2 and 3: the material being released
# must be committed; everything else in the tree is someone else's business.
DIRTY_PACKAGED="$(git -C "$REPO_ROOT" status --porcelain -- "${PACKAGED_PATHS[@]}")"
if [[ -n "$DIRTY_PACKAGED" ]]; then
	fail "Packaged files have uncommitted changes, so the tarball would not" \
		"match any commit. Commit them first:" \
		"" \
		"$(printf '%s\n' "$DIRTY_PACKAGED" | head -10)"
fi
DIRTY_ELSEWHERE="$(git -C "$REPO_ROOT" status --porcelain | grep -vc '^$' || true)"
if [[ "$DIRTY_ELSEWHERE" != "0" ]]; then
	echo "release-guard: ${DIRTY_ELSEWHERE} uncommitted path(s) outside the package — cannot reach the tarball, not blocking"
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
	# Filtered by the same packaged paths as check 3, deliberately. Commits after
	# the bump that cannot reach the tarball (this script, plan documents, the
	# docs site) leave the version describing the tree exactly as the release
	# commit would have. Refusing on those makes the guard fire on its own
	# maintenance, which is how a guard earns a habit of being overridden.
	SINCE_RELEASE="$(git -C "$REPO_ROOT" diff --name-only "${RELEASE_COMMIT}..HEAD" -- "${PACKAGED_PATHS[@]}")"
	if [[ -n "$SINCE_RELEASE" ]]; then
		fail "HEAD is ${AHEAD} commit(s) past the release commit for ${VERSION}, and those" \
			"commits change packaged files — so this tarball would ship a version" \
			"number that does not describe the tree." \
			"" \
			"  release commit: $(git -C "$REPO_ROOT" log -1 --format='%h %s' "$RELEASE_COMMIT")" \
			"  HEAD:           $(git -C "$REPO_ROOT" log -1 --format='%h %s' "$HEAD_COMMIT")" \
			"" \
			"Packaged files changed since the bump:" \
			"$(printf '      %s\n' $SINCE_RELEASE | head -10)" \
			"" \
			"Bump again for the work above, then publish that commit."
	fi
	echo "release-guard: ${AHEAD} commit(s) since the bump, none touching packaged files — ok"
fi

# 2b. The declared dependencies are actually installed.
#
# Publishing 1.54.0 failed after `npm whoami`, halfway through
# `prepublishOnly`: a dependency added on a plan branch was merged and never
# installed, so `tsc` could not resolve it. Merging brings the manifest
# change, not the install. Pure filesystem, so it runs before the network.
node "$PKG_DIR/scripts/check-install.js" "$PKG_DIR" || exit 1

# 3. Unmerged plan branches that could change the tarball.
#
# Uses the same PACKAGED_PATHS as check 2. A branch touching only
# `.indusk/planning/` cannot alter what ships, so it is named rather than
# refused — refusing on every in-flight plan would make the guard something
# people route around.

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

# 4. Already published.
#
# `npm view` is the authority (it honours scope-specific registry config in
# ~/.npmrc, which a direct fetch to registry.npmjs.org does not). A network
# failure returns nothing and is NOT treated as "not published" — an offline
# machine must not be told it is safe to republish, so silence skips the check
# and says so rather than passing it.
# `--fetch-timeout` bounds the network call. Without it a slow or unreachable
# registry hangs the release with no output at all — found by running this
# guard against a machine that could not reach npm, where it sat indefinitely.
PKG_NAME="$(node -p "require('$PKG_DIR/package.json').name")"
PUBLISHED="$(npm view "$PKG_NAME" versions --json --fetch-timeout=10000 2>/dev/null || true)"
if [[ -z "$PUBLISHED" ]]; then
	echo "release-guard: could not reach the registry — skipping the already-published check"
elif node -e "process.exit(JSON.parse(process.argv[1]).includes(process.argv[2]) ? 0 : 1)" "$PUBLISHED" "$VERSION" 2>/dev/null; then
	NEXT="$(node -e '
		const [maj, min, patch] = process.argv[1].split(".").map(Number);
		process.stdout.write(`${maj}.${min}.${patch + 1}`);
	' "$VERSION")"
	fail "${VERSION} is already on the registry — npm would reject this with a 403." \
		"" \
		"'pnpm release' publishes whatever version package.json holds; it never bumps." \
		"If there is new work to ship, bump to ${NEXT} as the last commit on main," \
		"then publish that commit."
fi

echo "release-guard: HEAD is the release commit for ${VERSION}, packaged paths clean, no unmerged packaged work, ${VERSION} not yet published — ok"
