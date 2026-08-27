#!/usr/bin/env bash
# setup-worktree.sh — create a new worktree of the wrapped repo in a flat
# single-repo workbench.
#
# Usage:
#   setup-worktree.sh [--repo <name>] [--worktrees-dir <dir>] <slug> [base-branch]
#
# Examples:
#   setup-worktree.sh feat-autoops-cancel-polish
#   setup-worktree.sh --repo avoca-next feat-thing main
#
# `--repo` names which declared repo to branch from. It is optional when the
# workbench declares exactly one; with several it is REQUIRED, and omitting it
# fails naming the candidates rather than defaulting to the first.
#
# What it does:
#   1. Resolves the workbench root (walks up from cwd to find
#      .indusk/config.json with worktree.shape == "workbench").
#   2. Resolves which declared repo to use (worktree.repos[], legacy
#      wrapped_repo reduced) + worktree.sibling_parent.
#   3. Reads .indusk/worktree-configs/<repo>.json for trunk_branch, base_branch,
#      copy_files[], append_files[], apply_commits[].
#   4. Creates a worktree at <workbench>/<slug>, branched off <base-branch>
#      (default: config's base_branch, fallback main).
#   5. Applies copy_files[], append_files[], apply_commits[] per config.
#   6. Writes <workbench>/<slug>/.indusk-overlay-state.json with the
#      applied apply_commits[] snapshot (so refresh-worktree.sh can detect
#      removals).
#
# Assumptions:
#   - jq is installed.
#   - The canonical clone lives at <sibling_parent>/<wrapped_repo>/.
#   - The workbench root contains a symlink <wrapped_repo> -> the canonical clone.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/workbench-helpers.sh
source "$SCRIPT_DIR/lib/workbench-helpers.sh"

REPO_ARG=""
WORKTREES_DIR=""
# Flags in any order; both optional. `--worktrees-dir` is passed by the TS
# wrapper when the repo DECLARES a worktrees location. Absent, worktrees land
# at the workbench root — today's flat layout, unchanged.
while [[ "${1:-}" == --* ]]; do
	case "$1" in
		--repo) REPO_ARG="${2:?--repo requires a repo name}"; shift 2 ;;
		--worktrees-dir) WORKTREES_DIR="${2:?--worktrees-dir requires a directory}"; shift 2 ;;
		*) echo "Error: unknown flag $1" >&2; exit 1 ;;
	esac
done
SLUG="${1:?Usage: setup-worktree.sh [--repo <name>] <slug> [base-branch]}"
BASE_BRANCH_ARG="${2:-}"

WORKBENCH_ROOT="$(_resolve_workbench_root)"
export WORKBENCH_ROOT

# One resolver for "which repo" — refuses rather than guessing when the
# workbench declares several and the caller named none.
REPO="$(_resolve_workbench_repo "$REPO_ARG")"

SIBLING_PARENT="$(_read_repos_root)"
if [[ -z "$SIBLING_PARENT" ]]; then
	echo "Error: could not resolve worktree.repos_root for this workbench" >&2
	exit 1
fi

CLIENT_ROOT="$SIBLING_PARENT/$REPO"
if [[ ! -d "$CLIENT_ROOT/.git" ]]; then
	echo "Error: $CLIENT_ROOT is not a git repo" >&2
	exit 1
fi

CONFIG_FILE="$WORKBENCH_ROOT/.indusk/worktree-configs/${REPO}.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
	echo "Error: no worktree config at $CONFIG_FILE" >&2
	echo "Run 'indusk extensions enable worktree' to scaffold the starter, or hand-create the file." >&2
	exit 1
fi

TRUNK_BRANCH="$(_read_worktree_config "$REPO" '.trunk_branch // "main"')"
CONFIG_BASE_BRANCH="$(_read_worktree_config "$REPO" '.base_branch // .trunk_branch // "main"')"
BASE_BRANCH="${BASE_BRANCH_ARG:-$CONFIG_BASE_BRANCH}"

# Reject slug collisions with the wrapped repo's name (resolution would be
# ambiguous; the trunk lives at that path).
if [[ -z "$WORKTREES_DIR" && "$SLUG" == "$REPO" ]]; then
	# Only a flat layout can collide — a declared worktrees directory puts the
	# worktree somewhere the trunk can never be.
	echo "Error: slug '$SLUG' collides with the wrapped repo name; pick a different slug" >&2
	exit 1
fi

# A declared location is a single clean segment (guarded on the TS side before
# it ever reaches here), so this join cannot escape the workbench.
if [[ -n "$WORKTREES_DIR" ]]; then
	WORKTREE_PATH="$WORKBENCH_ROOT/$WORKTREES_DIR/$SLUG"
	mkdir -p "$WORKBENCH_ROOT/$WORKTREES_DIR"
else
	WORKTREE_PATH="$WORKBENCH_ROOT/$SLUG"
fi
if [[ -e "$WORKTREE_PATH" ]]; then
	echo "Error: worktree already exists at $WORKTREE_PATH" >&2
	echo "To remove: git -C $CLIENT_ROOT worktree remove --force $WORKTREE_PATH" >&2
	exit 1
fi

# Branch name: use the slug verbatim. dawn-fde-toolkit's convention of
# prefixing with `feat/` was a per-engagement choice; the v1 extension is
# repo-shape-agnostic and leaves branch naming to the slug. If a project
# wants a prefix, it's added in the slug (e.g., `feat-cancel-polish`).
BRANCH_NAME="$SLUG"

echo "Setting up worktree:"
echo "  Workbench:    $WORKBENCH_ROOT"
echo "  Wrapped repo: $REPO"
echo "  Slug:         $SLUG"
echo "  Branch:       $BRANCH_NAME (off $BASE_BRANCH)"
echo "  Trunk:        $TRUNK_BRANCH"
echo "  Path:         $WORKTREE_PATH"
echo ""

# Create the worktree. `git worktree add` from the canonical clone.
git -C "$CLIENT_ROOT" worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME" "$BASE_BRANCH"

# --- copy_files ---
COPY_COUNT="$(jq '.copy_files | length' "$CONFIG_FILE" 2>/dev/null || echo 0)"
if [[ "$COPY_COUNT" -gt 0 ]]; then
	echo ""
	echo "Copying files per config..."
	jq -c '.copy_files[]' "$CONFIG_FILE" | while IFS= read -r entry; do
		src_rel="$(echo "$entry" | jq -r '.src')"
		dst_rel="$(echo "$entry" | jq -r '.dest')"
		src="$CLIENT_ROOT/$src_rel"
		dst="$WORKTREE_PATH/$dst_rel"
		if [[ -f "$src" ]]; then
			mkdir -p "$(dirname "$dst")"
			cp "$src" "$dst"
			echo "  copied: $src_rel -> $dst_rel"
		else
			echo "  WARN:   $src_rel not found in canonical clone, skipping"
		fi
	done
fi

# --- append_files (sentinel-wrapped for refresh idempotency) ---
APPEND_COUNT="$(jq '.append_files | length' "$CONFIG_FILE" 2>/dev/null || echo 0)"
if [[ "$APPEND_COUNT" -gt 0 ]]; then
	echo ""
	echo "Appending files per config..."
	jq -c '.append_files[]' "$CONFIG_FILE" | while IFS= read -r entry; do
		src_rel="$(echo "$entry" | jq -r '.src')"
		dst_rel="$(echo "$entry" | jq -r '.dest')"
		src="$WORKBENCH_ROOT/$src_rel"
		dst="$WORKTREE_PATH/$dst_rel"
		if [[ ! -f "$src" ]]; then
			echo "  WARN:   $src_rel not found in workbench, skipping"
			continue
		fi
		mkdir -p "$(dirname "$dst")"
		touch "$dst"
		{
			printf '\n# --- worktree-extension append (%s) ---\n' "$src_rel"
			cat "$src"
			printf '# --- end worktree-extension append ---\n'
		} >> "$dst"
		echo "  appended: $src_rel -> $dst_rel"
	done
fi

# --- apply_commits (upstream-file-overlay, always skip-worktree) ---
# Each entry: { "sha": "...", "files": [...] }. For each file we run
# `git show <sha>:<file> > <file>` then `git update-index --skip-worktree
# <file>` so the overlay is invisible to git status / diff. The snapshot
# is written to .indusk-overlay-state.json so refresh-worktree.sh can
# detect entries removed between runs.
APPLY_COUNT="$(jq '.apply_commits | length' "$CONFIG_FILE" 2>/dev/null || echo 0)"
if [[ "$APPLY_COUNT" -gt 0 ]]; then
	echo ""
	echo "Applying upstream-file-overlay entries..."
	jq -c '.apply_commits[]' "$CONFIG_FILE" | while IFS= read -r entry; do
		sha="$(echo "$entry" | jq -r '.sha')"
		echo "  $sha:"
		while IFS= read -r file; do
			(cd "$WORKTREE_PATH" && git show "$sha:$file" > "$file") &&
				(cd "$WORKTREE_PATH" && git update-index --skip-worktree "$file") &&
				echo "    overlaid + skip-worktree: $file" ||
				echo "    WARN: failed to overlay $file from $sha"
		done < <(echo "$entry" | jq -r '.files[]')
	done
fi

# Always write the state file (empty array if no apply_commits) so
# refresh-worktree.sh has a baseline. We write under the per-worktree
# gitdir (typically <canonical>/.git/worktrees/<slug>/) where git
# explicitly ignores its own internals — invisible to git status / diff
# without needing .gitignore or .git/info/exclude (which don't work
# per-worktree). The path is stable across `git worktree move`.
GIT_DIR="$(cd "$WORKTREE_PATH" && git rev-parse --git-dir)"
STATE_FILE="$GIT_DIR/indusk-overlay-state.json"
jq '{apply_commits: (.apply_commits // [])}' "$CONFIG_FILE" > "$STATE_FILE"

echo ""
echo "Done. Worktree available at $WORKTREE_PATH"
