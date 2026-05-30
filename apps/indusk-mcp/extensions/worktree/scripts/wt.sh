#!/usr/bin/env bash
# wt.sh — run a pnpm command inside a worktree or the trunk of a flat
# single-repo workbench.
#
# Usage:
#   pnpm wt <slug>[:<app>] <command> [args...]
#
# Examples:
#   pnpm wt cancel-polish dev          # cd <workbench>/cancel-polish/, run `pnpm dev`
#   pnpm wt cancel-polish:web build    # cd <workbench>/cancel-polish/apps/web/, run `pnpm build`
#   pnpm wt numero lint                # cd <workbench>/numero/ (trunk symlink), run `pnpm lint`
#   pnpm wt cancel-polish ce dc:up local
#                                      # cd cancel-polish/, run `pnpm ce dc:up local`
#                                      # composable.env picks up the worktree's env
#
# Resolution (single-pass, flat workbench shape):
#   - Look at subdirs/symlinks at workbench root
#   - Exact match: <slug> matches a subdir name exactly
#   - Suffix match (fallback): <slug> matches a subdir ending with -<slug>
#   - Reserved names skipped: `.indusk`, `node_modules`, `dist`, `.git`
#   - Multiple matches → error with the candidates listed
#   - Zero matches → error with the available subdirs listed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/workbench-helpers.sh
source "$SCRIPT_DIR/lib/workbench-helpers.sh"

TARGET="${1:-}"
shift || true
COMMAND=("$@")

usage() {
	cat <<'EOF'
Usage: pnpm wt <slug>[:<app>] <command> [args...]

Examples:
  pnpm wt cancel-polish dev
  pnpm wt cancel-polish:web build
  pnpm wt <wrapped-repo> lint              # the trunk
  pnpm wt cancel-polish ce dc:up local     # ce composition

EOF
}

if [[ -z "$TARGET" || ${#COMMAND[@]} -eq 0 ]]; then
	usage
	exit 1
fi

if [[ ! "$TARGET" =~ ^([^:]+)(:([^:]+))?$ ]]; then
	echo "Error: invalid target shape: '$TARGET'" >&2
	usage
	exit 1
fi

SLUG="${BASH_REMATCH[1]}"
APP="${BASH_REMATCH[3]:-}"

WORKBENCH_ROOT="$(_resolve_workbench_root)"

# Skip reserved/non-checkout entries at workbench root.
_is_reserved_name() {
	case "$1" in
		.indusk | .claude | .vscode | .cursor | node_modules | dist | build | .git | .next | scripts | env) return 0 ;;
		*) return 1 ;;
	esac
}

# Single-pass slug resolution against subdirs at workbench root.
# Exact matches collected first; if none, fall back to suffix matches.
exact_paths=()
suffix_paths=()
for entry in "$WORKBENCH_ROOT"/*; do
	[[ -e "$entry" ]] || continue
	# Real dirs OR symlinks-to-dirs both count (the trunk is a symlink).
	[[ -d "$entry" ]] || continue
	name="$(basename "$entry")"
	_is_reserved_name "$name" && continue
	if [[ "$name" == "$SLUG" ]]; then
		exact_paths+=("$entry")
	elif [[ "$name" == *"-$SLUG" ]]; then
		suffix_paths+=("$entry")
	fi
done

# Exact match wins; suffix only if no exact.
candidate_paths=()
if [[ ${#exact_paths[@]} -gt 0 ]]; then
	candidate_paths=("${exact_paths[@]}")
elif [[ ${#suffix_paths[@]} -gt 0 ]]; then
	candidate_paths=("${suffix_paths[@]}")
fi

if [[ ${#candidate_paths[@]} -eq 0 ]]; then
	echo "Error: no worktree or trunk matching slug '$SLUG' at $WORKBENCH_ROOT" >&2
	echo "Available targets:" >&2
	for entry in "$WORKBENCH_ROOT"/*; do
		[[ -d "$entry" ]] || continue
		name="$(basename "$entry")"
		_is_reserved_name "$name" && continue
		printf '  %s\n' "$name" >&2
	done
	exit 1
fi

if [[ ${#candidate_paths[@]} -gt 1 ]]; then
	echo "Error: multiple targets match slug '$SLUG':" >&2
	for p in "${candidate_paths[@]}"; do
		printf '  %s\n' "$(basename "$p")" >&2
	done
	echo "Use the full name." >&2
	exit 1
fi

WORKTREE_PATH="${candidate_paths[0]}"
WORKTREE_NAME="$(basename "$WORKTREE_PATH")"

if [[ -n "$APP" ]]; then
	APP_PATH="$WORKTREE_PATH/apps/$APP"
	if [[ ! -d "$APP_PATH" ]]; then
		echo "Error: app not found at $APP_PATH" >&2
		if [[ -d "$WORKTREE_PATH/apps" ]]; then
			echo "Available apps in $WORKTREE_NAME:" >&2
			ls -1 "$WORKTREE_PATH/apps" 2>/dev/null | sed 's/^/  /' >&2
		fi
		exit 1
	fi
	echo "[$WORKTREE_NAME/apps/$APP] pnpm ${COMMAND[*]}"
	cd "$APP_PATH"
	exec pnpm "${COMMAND[@]}"
fi

echo "[$WORKTREE_NAME] pnpm ${COMMAND[*]}"
cd "$WORKTREE_PATH"
exec pnpm "${COMMAND[@]}"
