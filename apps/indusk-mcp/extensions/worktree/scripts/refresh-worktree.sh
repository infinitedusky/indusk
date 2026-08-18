#!/usr/bin/env bash
# refresh-worktree.sh — re-apply the worktree config to an existing worktree,
# idempotently. Cleans up overlays for apply_commits[] entries that have been
# REMOVED from the config since the last run (ADR D7 fix-in-scope).
#
# Usage:
#   refresh-worktree.sh <slug>
#   refresh-worktree.sh --all
#
# What it does (in order):
#   1. Resolves the workbench root + reads worktree.wrapped_repo from config.
#   2. Reads the worktree's overlay state file (under the per-worktree
#      gitdir) — the snapshot of the prior apply_commits[].
#   3. Diffs prior vs current apply_commits[]: for any entry that's in
#      prior but NOT current, runs `git update-index --no-skip-worktree`
#      on its files AND `git checkout HEAD -- <file>` to restore them
#      to their main-branch content (otherwise they'd keep the old
#      overlay's content as untracked-but-skipped). This is the
#      ADR D7 fix-in-scope.
#   4. Re-runs copy_files[] (overwrite).
#   5. Re-runs append_files[] with sentinel-bounded replacement.
#   6. Re-runs apply_commits[] (overwrite + skip-worktree).
#   7. Writes the updated state file.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/workbench-helpers.sh
source "$SCRIPT_DIR/lib/workbench-helpers.sh"

ARG="${1:?Usage: refresh-worktree.sh <slug|--all>}"

WORKBENCH_ROOT="$(_resolve_workbench_root)"
export WORKBENCH_ROOT

REPO="$(_resolve_workbench_repo "${REPO_ARG:-}")"

SIBLING_PARENT_RAW="$(_read_workbench_field sibling_parent)"
SIBLING_PARENT="$(_expand_path "$SIBLING_PARENT_RAW")"
CLIENT_ROOT="$SIBLING_PARENT/$REPO"

CONFIG_FILE="$WORKBENCH_ROOT/.indusk/worktree-configs/${REPO}.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
	echo "Error: no worktree config at $CONFIG_FILE" >&2
	exit 1
fi

refresh_one() {
	local worktree_path="$1"
	local slug
	slug="$(basename "$worktree_path")"

	# Skip non-existent paths and the trunk symlink itself.
	if [[ ! -d "$worktree_path" ]]; then
		echo "  SKIP: $slug — directory not found"
		return 0
	fi
	if [[ "$slug" == "$REPO" ]]; then
		return 0 # trunk symlink, not a worktree
	fi
	# Check this is actually a git worktree (has a .git file pointing into
	# the canonical clone's worktrees/ dir).
	if [[ ! -e "$worktree_path/.git" ]]; then
		echo "  SKIP: $slug — not a git worktree"
		return 0
	fi

	echo ""
	echo "Refreshing: $slug"

	local gitdir
	gitdir="$(cd "$worktree_path" && git rev-parse --git-dir)"
	local state_file="$gitdir/indusk-overlay-state.json"

	# --- ADR D7 fix-in-scope: clear skip-worktree for removed apply_commits entries ---
	if [[ -f "$state_file" ]]; then
		# Prior state's apply_commits[].files vs current config's apply_commits[].files.
		# A file is "removed" if it was in the prior snapshot but is no longer in any
		# current apply_commits[] entry. For each removed file:
		#   1. Unflag skip-worktree (so git can write through)
		#   2. Restore from HEAD (so the overlaid content goes away)
		local prior_files current_files removed_files
		prior_files="$(jq -r '[.apply_commits[]?.files[]?] | unique | .[]' "$state_file" 2>/dev/null || true)"
		current_files="$(jq -r '[.apply_commits[]?.files[]?] | unique | .[]' "$CONFIG_FILE" 2>/dev/null || true)"
		# Files in prior but not in current — use comm against sorted lists.
		removed_files="$(comm -23 <(echo "$prior_files" | sort -u) <(echo "$current_files" | sort -u))"

		if [[ -n "$removed_files" ]]; then
			echo "  Clearing skip-worktree on removed-from-config files:"
			while IFS= read -r f; do
				[[ -z "$f" ]] && continue
				(cd "$worktree_path" && git update-index --no-skip-worktree "$f" 2>/dev/null || true)
				(cd "$worktree_path" && git checkout HEAD -- "$f" 2>/dev/null) &&
					echo "    cleared + restored: $f" ||
					echo "    WARN: $f — could not restore from HEAD (may need manual cleanup)"
			done <<< "$removed_files"
		fi
	fi

	# --- copy_files (overwrite) ---
	local copy_count
	copy_count="$(jq '.copy_files | length' "$CONFIG_FILE" 2>/dev/null || echo 0)"
	if [[ "$copy_count" -gt 0 ]]; then
		jq -c '.copy_files[]' "$CONFIG_FILE" | while IFS= read -r entry; do
			local src_rel dst_rel src dst
			src_rel="$(echo "$entry" | jq -r '.src')"
			dst_rel="$(echo "$entry" | jq -r '.dest')"
			src="$CLIENT_ROOT/$src_rel"
			dst="$worktree_path/$dst_rel"
			if [[ -f "$src" ]]; then
				mkdir -p "$(dirname "$dst")"
				cp "$src" "$dst"
				echo "    copied: $src_rel -> $dst_rel"
			else
				echo "    WARN: $src_rel not found, skipping"
			fi
		done
	fi

	# --- append_files (sentinel-bounded replacement) ---
	local append_count
	append_count="$(jq '.append_files | length' "$CONFIG_FILE" 2>/dev/null || echo 0)"
	if [[ "$append_count" -gt 0 ]]; then
		jq -c '.append_files[]' "$CONFIG_FILE" | while IFS= read -r entry; do
			local src_rel dst_rel src dst marker end_marker
			src_rel="$(echo "$entry" | jq -r '.src')"
			dst_rel="$(echo "$entry" | jq -r '.dest')"
			src="$WORKBENCH_ROOT/$src_rel"
			dst="$worktree_path/$dst_rel"
			marker="# --- worktree-extension append (${src_rel}) ---"
			end_marker="# --- end worktree-extension append ---"

			if [[ ! -f "$src" ]]; then
				echo "    WARN: append src $src_rel not found, skipping"
				continue
			fi

			mkdir -p "$(dirname "$dst")"
			touch "$dst"

			# Strip any prior block for THIS src_rel (matching the per-src marker).
			if grep -qF "$marker" "$dst"; then
				awk -v start="$marker" -v end="$end_marker" '
					$0 == start { skip=1; next }
					skip && $0 == end { skip=0; next }
					!skip { print }
				' "$dst" > "$dst.tmp" && mv "$dst.tmp" "$dst"
			fi

			# Append fresh block
			{
				printf '\n%s\n' "$marker"
				cat "$src"
				printf '%s\n' "$end_marker"
			} >> "$dst"
			echo "    appended: $src_rel -> $dst_rel"
		done
	fi

	# --- apply_commits (re-overlay from current SHA, always skip-worktree) ---
	local apply_count
	apply_count="$(jq '.apply_commits | length' "$CONFIG_FILE" 2>/dev/null || echo 0)"
	if [[ "$apply_count" -gt 0 ]]; then
		jq -c '.apply_commits[]' "$CONFIG_FILE" | while IFS= read -r entry; do
			local sha
			sha="$(echo "$entry" | jq -r '.sha')"
			while IFS= read -r file; do
				# Unflag skip-worktree so git show can write through, then re-overlay
				# + re-flag skip-worktree.
				(cd "$worktree_path" && git update-index --no-skip-worktree "$file" 2>/dev/null || true)
				(cd "$worktree_path" && git show "$sha:$file" > "$file" 2>/dev/null) &&
					(cd "$worktree_path" && git update-index --skip-worktree "$file") &&
					echo "    overlaid + skip-worktree: $file [$sha]" ||
					echo "    WARN: failed to overlay $file from $sha"
			done < <(echo "$entry" | jq -r '.files[]')
		done
	fi

	# Update the state file to reflect current apply_commits[].
	jq '{apply_commits: (.apply_commits // [])}' "$CONFIG_FILE" > "$state_file"
}

if [[ "$ARG" == "--all" ]]; then
	echo "Refreshing all worktrees in $WORKBENCH_ROOT (excluding the trunk symlink)..."
	for d in "$WORKBENCH_ROOT"/*/; do
		[[ -d "$d" ]] || continue
		refresh_one "${d%/}"
	done
else
	refresh_one "$WORKBENCH_ROOT/$ARG"
fi

echo ""
echo "Done."
