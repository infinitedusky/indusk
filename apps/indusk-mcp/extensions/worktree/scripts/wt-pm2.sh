#!/usr/bin/env bash
# wt-pm2.sh — start one or more long-running dev processes for worktrees
# under pm2. Resolution matches wt.sh (flat single-repo workbench).
#
# Usage:
#   pnpm wt:pm2 <slug>[:<app>] <command> [<slug>[:<app>] <command> ...]
#
# Examples:
#   # one process:
#   pnpm wt:pm2 cancel-polish:web dev
#
#   # full local-dev stack for one worktree:
#   pnpm wt:pm2 cancel-polish:web dev cancel-polish:web inngest cancel-polish:dashboard dev
#
# pm2 process naming: <slug>-<app>-<command> (or <slug>-<command> when no :<app>).
#
# Manage with `pnpm exec pm2 list / logs / stop / delete`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/workbench-helpers.sh
source "$SCRIPT_DIR/lib/workbench-helpers.sh"

usage() {
	cat <<'EOF'
Usage: pnpm wt:pm2 <slug>[:<app>] <command> [<slug>[:<app>] <command> ...]

Args come in pairs. Each pair starts one pm2 process named
<slug>-<app>-<command> (or <slug>-<command> without :<app>).

Examples:
  pnpm wt:pm2 cancel-polish:web dev
  pnpm wt:pm2 cancel-polish:web dev cancel-polish:web inngest cancel-polish:dashboard dev

Manage:
  pnpm exec pm2 list
  pnpm exec pm2 logs <name>
  pnpm exec pm2 stop <name>
  pnpm exec pm2 delete all
EOF
}

if [[ $# -eq 0 || $# -lt 2 ]]; then
	usage
	exit 1
fi

if [[ $(($# % 2)) -ne 0 ]]; then
	echo "Error: expected an even number of arguments (pairs of <target> <command>), got $#" >&2
	echo "" >&2
	usage >&2
	exit 1
fi

WORKBENCH_ROOT="$(_resolve_workbench_root)"

# Reserved/non-checkout names at workbench root.
_is_reserved_name() {
	case "$1" in
		.indusk | .claude | .vscode | .cursor | node_modules | dist | build | .git | .next | scripts | env) return 0 ;;
		*) return 1 ;;
	esac
}

# resolve_target <target> → echoes "<base-name> <cwd>"
# base-name format: <slug> or <slug>-<app> (commands tack on -<command>)
resolve_target() {
	local target="$1"

	if [[ ! "$target" =~ ^([^:]+)(:([^:]+))?$ ]]; then
		echo "Error: invalid target shape: '$target'" >&2
		return 1
	fi

	local slug="${BASH_REMATCH[1]}"
	local app="${BASH_REMATCH[3]:-}"

	local exact_paths=() suffix_paths=()
	for entry in "$WORKBENCH_ROOT"/*; do
		[[ -d "$entry" ]] || continue
		local name
		name="$(basename "$entry")"
		_is_reserved_name "$name" && continue
		if [[ "$name" == "$slug" ]]; then
			exact_paths+=("$entry")
		elif [[ "$name" == *"-$slug" ]]; then
			suffix_paths+=("$entry")
		fi
	done

	local candidate_paths=()
	if [[ ${#exact_paths[@]} -gt 0 ]]; then
		candidate_paths=("${exact_paths[@]}")
	elif [[ ${#suffix_paths[@]} -gt 0 ]]; then
		candidate_paths=("${suffix_paths[@]}")
	fi

	if [[ ${#candidate_paths[@]} -eq 0 ]]; then
		echo "Error: no worktree or trunk matching slug '$slug' at $WORKBENCH_ROOT" >&2
		return 1
	fi
	if [[ ${#candidate_paths[@]} -gt 1 ]]; then
		echo "Error: multiple targets match slug '$slug': ${candidate_paths[*]}" >&2
		return 1
	fi

	local worktree_path="${candidate_paths[0]}"

	if [[ -n "$app" ]]; then
		local app_path="$worktree_path/apps/$app"
		if [[ ! -d "$app_path" ]]; then
			echo "Error: app not found at $app_path" >&2
			return 1
		fi
		echo "$slug-$app $app_path"
	else
		echo "$slug $worktree_path"
	fi
}

# Dry-run support for testing: emit the would-be pm2 invocations to
# stdout instead of running pm2. Triggered via WT_PM2_DRY_RUN=1.
DRY_RUN="${WT_PM2_DRY_RUN:-}"

echo "Starting pm2 processes…"
echo ""

while [[ $# -gt 0 ]]; do
	TARGET="$1"
	CMD="$2"
	shift 2

	# resolve_target prints "<base-name> <cwd>" on stdout, errors to stderr.
	# Use process substitution to capture stdout only.
	RESOLVED="$(resolve_target "$TARGET")"
	read -r BASE_NAME CWD <<<"$RESOLVED"
	PROC_NAME="${BASE_NAME}-${CMD}"

	echo "→ $PROC_NAME"
	echo "  cwd: $CWD"
	echo "  cmd: pnpm $CMD"

	if [[ -n "$DRY_RUN" ]]; then
		echo "  (dry-run: would invoke pm2)"
		echo ""
		continue
	fi

	(
		cd "$CWD"
		pnpm exec pm2 start pnpm \
			--name "$PROC_NAME" \
			--cwd "$CWD" \
			--update-env \
			--no-autorestart \
			-- "$CMD"
	) >/dev/null

	echo ""
done

if [[ -z "$DRY_RUN" ]]; then
	echo "Done. Status:"
	pnpm exec pm2 list
	echo ""
	echo "Tail logs:  pnpm exec pm2 logs <name>"
	echo "Stop one:   pnpm exec pm2 stop <name>"
	echo "Stop all:   pnpm exec pm2 delete all"
fi
