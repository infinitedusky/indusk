#!/usr/bin/env bash
# wt.sh — run a command inside a worktree or the trunk of a flat
# single-repo workbench.
#
# Usage:
#   pnpm wt <slug>[:<app>] <command> [args...]
#   pnpm wt <slug>[:<app>] -- <binary> [args...]
#
# Examples:
#   pnpm wt cancel-polish dev          # cd <workbench>/cancel-polish/, run `pnpm dev`
#   pnpm wt cancel-polish:web build    # cd <workbench>/cancel-polish/apps/web/, run `pnpm build`
#   pnpm wt numero lint                # cd <workbench>/numero/ (trunk symlink), run `pnpm lint`
#   pnpm wt cancel-polish ce dc:up local
#                                      # cd cancel-polish/, run `pnpm ce dc:up local`
#                                      # composable.env picks up the worktree's env
#   pnpm wt solana-migration -- docker compose --env-file .env.local up -d
#                                      # cd solana-migration/, exec `docker compose ...`
#                                      # directly — no pnpm prefix. Use `--` to bypass
#                                      # pnpm when args would otherwise be consumed by
#                                      # pnpm's own flag parsing (e.g., --env-file).
#
# Resolution (single-pass, flat workbench shape):
#   - Look at subdirs/symlinks at workbench root
#   - Exact match: <slug> matches a subdir name exactly
#   - Suffix match (fallback): <slug> matches a subdir ending with -<slug>
#   - Reserved names skipped: `.indusk`, `node_modules`, `dist`, `.git`
#   - Multiple matches → error with the candidates listed
#   - Zero matches → error with the available subdirs listed
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
  pnpm wt <slug>[:<app>] <command> [args...]
  pnpm wt <slug>[:<app>] -- <binary> [args...]

Examples:
  pnpm wt cancel-polish dev
  pnpm wt cancel-polish:web build
  pnpm wt <wrapped-repo> lint              # the trunk
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

# Skip reserved/non-checkout entries at workbench root.
_is_reserved_name() {
	case "$1" in
		.indusk | .claude | .vscode | .cursor | node_modules | dist | build | .git | .next | scripts | env) return 0 ;;
		*) return 1 ;;
	esac
}

# Slug resolution across the workbench root AND every declared worktrees
# directory. Scanning the root alone made a declared layout invisible: the
# worktrees were one level down, so `wt <slug>` reported "no worktree matching"
# for a worktree that plainly existed.
#
# A slug may be qualified as `<repo>/<slug>` to disambiguate. Repo-qualified,
# not directory-qualified: the repo name and the slug are what a person knows,
# while the directory is a config detail that changes when the layout does.
QUALIFIER=""
if [[ "$SLUG" == */* ]]; then
	QUALIFIER="${SLUG%%/*}"
	SLUG="${SLUG#*/}"
fi

# "<repo>\t<dir>" per declared repo; dir empty means the workbench root.
declare -a search_repos=() search_dirs=()
while IFS=$'\t' read -r _name _dir; do
	[[ -n "$_name" ]] || continue
	# Only DECLARED directories get their own pass. A repo that declares none
	# keeps its worktrees at the root, which the root pass below already
	# covers — searching the root twice found every entry twice and turned
	# every flat-layout slug into a false "multiple targets match".
	[[ -n "$_dir" ]] || continue
	search_repos+=("$_name")
	search_dirs+=("$_dir")
done < <(_read_workbench_worktree_dirs)

# The root is always searched too — trunks live there, and so do the worktrees
# of any repo that declares no location (the flat layout).
search_repos+=("")
search_dirs+=("")

exact_paths=(); exact_repos=()
suffix_paths=(); suffix_repos=()
for idx in "${!search_dirs[@]}"; do
	repo="${search_repos[$idx]}"
	dir="${search_dirs[$idx]}"
	# A qualifier narrows the search to that repo, so `alpha/x` cannot match
	# beta's `x`. The unqualified root pass is kept for trunks.
	if [[ -n "$QUALIFIER" && -n "$repo" && "$repo" != "$QUALIFIER" ]]; then continue; fi
	if [[ -n "$QUALIFIER" && -z "$repo" ]]; then continue; fi
	base="$WORKBENCH_ROOT"
	[[ -n "$dir" ]] && base="$WORKBENCH_ROOT/$dir"
	[[ -d "$base" ]] || continue
	for entry in "$base"/*; do
		[[ -e "$entry" ]] || continue
		[[ -d "$entry" ]] || continue
		name="$(basename "$entry")"
		[[ -z "$dir" ]] && _is_reserved_name "$name" && continue
		if [[ "$name" == "$SLUG" ]]; then
			exact_paths+=("$entry"); exact_repos+=("$repo")
		elif [[ "$name" == *"-$SLUG" ]]; then
			suffix_paths+=("$entry"); suffix_repos+=("$repo")
		fi
	done
done

# Exact match wins; suffix only if no exact.
candidate_paths=(); candidate_repos=()
if [[ ${#exact_paths[@]} -gt 0 ]]; then
	candidate_paths=("${exact_paths[@]}"); candidate_repos=("${exact_repos[@]}")
elif [[ ${#suffix_paths[@]} -gt 0 ]]; then
	candidate_paths=("${suffix_paths[@]}"); candidate_repos=("${suffix_repos[@]}")
fi

if [[ ${#candidate_paths[@]} -eq 0 ]]; then
	echo "Error: no worktree or trunk matching slug '$SLUG' at $WORKBENCH_ROOT" >&2
	echo "Available targets:" >&2
	for idx in "${!search_dirs[@]}"; do
		repo="${search_repos[$idx]}"; dir="${search_dirs[$idx]}"
		base="$WORKBENCH_ROOT"; [[ -n "$dir" ]] && base="$WORKBENCH_ROOT/$dir"
		[[ -d "$base" ]] || continue
		for entry in "$base"/*; do
			[[ -d "$entry" ]] || continue
			name="$(basename "$entry")"
			[[ -z "$dir" ]] && _is_reserved_name "$name" && continue
			if [[ -n "$repo" ]]; then printf '  %s/%s\n' "$repo" "$name" >&2; else printf '  %s\n' "$name" >&2; fi
		done
	done
	exit 1
fi

if [[ ${#candidate_paths[@]} -gt 1 ]]; then
	echo "Error: multiple targets match slug '$SLUG':" >&2
	for i in "${!candidate_paths[@]}"; do
		if [[ -n "${candidate_repos[$i]}" ]]; then
			printf '  %s/%s\n' "${candidate_repos[$i]}" "$(basename "${candidate_paths[$i]}")" >&2
		else
			printf '  %s\n' "$(basename "${candidate_paths[$i]}")" >&2
		fi
	done
	echo "Name the repo to disambiguate, e.g. \`wt <repo>/$SLUG\`." >&2
	exit 1
fi

WORKTREE_PATH="${candidate_paths[0]}"
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
