#!/usr/bin/env bash
# wt.sh — run a command inside a worktree or a trunk of a workbench.
#
# Usage:
#   pnpm wt <target>[:<app>] <command> [args...]
#   pnpm wt <target>[:<app>] -- <binary> [args...]
#
# Targets (resolved by _wt_resolve_target in lib/workbench-helpers.sh — the
# ONE resolution surface, shared with wt-pm2.sh):
#   main                the trunk, when one repo is declared
#   <repo>/main         the trunk of <repo>, when several are
#   <repo>              same trunk, addressed by its declared name
#   <slug>              a worktree, found at the workbench root or in any
#                       DECLARED worktrees directory; exact match wins,
#                       `-<slug>` suffix as fallback
#   <repo>/<slug>       a worktree, disambiguated by owning repo
#
# Trunks resolve from CONFIG (`worktree.repos[]` / `repos_root` /
# `wrapped_repo`+`sibling_parent`), never by scanning: the declared
# workbench-side path when it exists (trunk symlink or nested checkout),
# else `<repos_root>/<name>`. A workbench whose trunk link was never made
# still routes correctly.
#
# Examples:
#   pnpm wt main dev                   # cd the trunk, run `pnpm dev`
#   pnpm wt cancel-polish dev          # cd <workbench>/cancel-polish/, run `pnpm dev`
#   pnpm wt cancel-polish:web build    # cd <workbench>/cancel-polish/apps/web/, run `pnpm build`
#   pnpm wt numero lint                # cd numero's trunk, run `pnpm lint`
#   pnpm wt cancel-polish ce dc:up local
#                                      # cd cancel-polish/, run `pnpm ce dc:up local`
#                                      # composable.env picks up the worktree's env
#   pnpm wt solana-migration -- docker compose --env-file .env.local up -d
#                                      # cd solana-migration/, exec `docker compose ...`
#                                      # directly — no pnpm prefix. Use `--` to bypass
#                                      # pnpm when args would otherwise be consumed by
#                                      # pnpm's own flag parsing (e.g., --env-file).
#
# pnpm-prefix vs raw exec:
#   - Default: prepends `pnpm` to the command (works for package.json scripts
#     and pnpm-aware tools like `pnpm ce`).
#   - With `--` as the first command arg: exec the remaining args directly,
#     without prepending pnpm. Required when running external binaries whose
#     flags conflict with pnpm's own flags (notably `--env-file`, which pnpm
#     9+ consumes as a global option). See `pnpm docker compose --env-file
#     .env.local …` for the bug shape this fixes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/workbench-helpers.sh
source "$SCRIPT_DIR/lib/workbench-helpers.sh"

TARGET="${1:-}"
shift || true
COMMAND=("$@")

usage() {
	cat <<'EOF'
Usage:
  pnpm wt <target>[:<app>] <command> [args...]
  pnpm wt <target>[:<app>] -- <binary> [args...]

Targets:
  main | <repo>/main | <repo>    a trunk, resolved from .indusk/config.json
  <slug> | <repo>/<slug>         a worktree

Examples:
  pnpm wt main dev
  pnpm wt cancel-polish dev
  pnpm wt cancel-polish:web build
  pnpm wt cancel-polish ce dc:up local     # ce composition (pnpm-aware)
  pnpm wt cancel-polish -- docker compose --env-file .env.local up -d
                                            # raw exec, no pnpm prefix.
                                            # Use when args conflict with
                                            # pnpm flags (e.g., --env-file).

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

WORKTREE_PATH="$(_wt_resolve_target "$SLUG")"
WORKTREE_NAME="$(basename "$WORKTREE_PATH")"

# Raw-exec mode: if the first command token is `--`, run the rest directly
# without prepending `pnpm`. Required for commands whose flags conflict with
# pnpm's own flag parsing (e.g., `--env-file` is consumed by pnpm 9+).
RAW_EXEC=0
if [[ ${#COMMAND[@]} -gt 0 && "${COMMAND[0]}" == "--" ]]; then
	RAW_EXEC=1
	COMMAND=("${COMMAND[@]:1}")
	if [[ ${#COMMAND[@]} -eq 0 ]]; then
		echo "Error: '--' specified but no command followed" >&2
		usage
		exit 1
	fi
fi

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
	if (( RAW_EXEC )); then
		echo "[$WORKTREE_NAME/apps/$APP] ${COMMAND[*]}"
		cd "$APP_PATH"
		exec "${COMMAND[@]}"
	else
		echo "[$WORKTREE_NAME/apps/$APP] pnpm ${COMMAND[*]}"
		cd "$APP_PATH"
		exec pnpm "${COMMAND[@]}"
	fi
fi

if (( RAW_EXEC )); then
	echo "[$WORKTREE_NAME] ${COMMAND[*]}"
	cd "$WORKTREE_PATH"
	exec "${COMMAND[@]}"
else
	echo "[$WORKTREE_NAME] pnpm ${COMMAND[*]}"
	cd "$WORKTREE_PATH"
	exec pnpm "${COMMAND[@]}"
fi
