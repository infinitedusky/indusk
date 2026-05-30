#!/usr/bin/env bash
# preflight.sh — run a worktree's pre-push checks, scoped to files
# changed vs the base branch. Mirrors CI's scoping so green-here =
# green-in-CI.
#
# Usage:
#   pnpm preflight <slug> [base-branch]
#
# What it does:
#   1. Resolves <slug> to a worktree at workbench root (NOT the trunk —
#      preflight is a feature-branch concept).
#   2. Computes CHANGED_FILES = union of committed (vs merge-base),
#      staged, and unstaged file lists.
#   3. Skip-fast: empty CHANGED_FILES → exit 0 in ~ms (T10 < 2s).
#   4. Computes CHANGED_FILES_BIOME (filter to extensions biome handles).
#   5. Applies preflight_env{} declarative path filters from config —
#      for each key, glob-match patterns against CHANGED_FILES; export
#      the key as truthy on any match.
#   6. Runs each preflight[] entry's command. Skips entries whose
#      `when` env var is falsy/unset. Stops on first failure.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/workbench-helpers.sh
source "$SCRIPT_DIR/lib/workbench-helpers.sh"

usage() {
	cat <<'EOF'
Usage: pnpm preflight <slug> [base-branch]

Examples:
  pnpm preflight cancel-polish
  pnpm preflight cancel-polish origin/main

Available env vars inside each preflight command:
  $CHANGED_FILES         newline-separated, all changed files
  $CHANGED_FILES_BIOME   space-separated, files biome handles
                         (.js .jsx .ts .tsx .css .json .jsonc)
  $<KEY>                 each preflight_env{} key, "1" when its globs
                         match any CHANGED_FILES entry (empty otherwise)
EOF
}

SLUG="${1:-}"
BASE_BRANCH="${2:-origin/main}"

if [[ -z "$SLUG" ]]; then
	usage
	exit 1
fi

WORKBENCH_ROOT="$(_resolve_workbench_root)"
export WORKBENCH_ROOT

WRAPPED_REPO="$(_read_workbench_field wrapped_repo)"
if [[ -z "$WRAPPED_REPO" ]]; then
	echo "Error: .indusk/config.json missing worktree.wrapped_repo" >&2
	exit 1
fi

CONFIG_FILE="$WORKBENCH_ROOT/.indusk/worktree-configs/${WRAPPED_REPO}.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
	echo "Error: no worktree config at $CONFIG_FILE" >&2
	exit 1
fi

# Reject preflighting the trunk — preflight is a feature-branch concept.
if [[ "$SLUG" == "$WRAPPED_REPO" ]]; then
	echo "Error: preflight cannot target the trunk; pick a worktree slug" >&2
	exit 1
fi

# Slug resolution (single-pass against workbench root; same as wt.sh).
_is_reserved_name() {
	case "$1" in
		.indusk | .claude | .vscode | .cursor | node_modules | dist | build | .git | .next | scripts | env) return 0 ;;
		*) return 1 ;;
	esac
}

exact_paths=()
suffix_paths=()
for entry in "$WORKBENCH_ROOT"/*; do
	[[ -d "$entry" ]] || continue
	name="$(basename "$entry")"
	_is_reserved_name "$name" && continue
	# Skip the trunk symlink — preflight is for feature worktrees.
	[[ "$name" == "$WRAPPED_REPO" ]] && continue
	if [[ "$name" == "$SLUG" ]]; then
		exact_paths+=("$entry")
	elif [[ "$name" == *"-$SLUG" ]]; then
		suffix_paths+=("$entry")
	fi
done

candidate_paths=()
if [[ ${#exact_paths[@]} -gt 0 ]]; then
	candidate_paths=("${exact_paths[@]}")
elif [[ ${#suffix_paths[@]} -gt 0 ]]; then
	candidate_paths=("${suffix_paths[@]}")
fi

if [[ ${#candidate_paths[@]} -eq 0 ]]; then
	echo "Error: no worktree matching slug '$SLUG' at $WORKBENCH_ROOT" >&2
	exit 1
fi
if [[ ${#candidate_paths[@]} -gt 1 ]]; then
	echo "Error: multiple worktrees match slug '$SLUG':" >&2
	for p in "${candidate_paths[@]}"; do
		printf '  %s\n' "$(basename "$p")" >&2
	done
	exit 1
fi

WORKTREE_PATH="${candidate_paths[0]}"
WORKTREE_NAME="$(basename "$WORKTREE_PATH")"

# Read preflight[] from config. Each entry: { name, command, when? }.
PREFLIGHT_COUNT="$(jq '.preflight | length' "$CONFIG_FILE" 2>/dev/null || echo 0)"
if [[ "$PREFLIGHT_COUNT" -eq 0 ]]; then
	echo "Warning: no preflight commands in $CONFIG_FILE" >&2
	exit 0
fi

cd "$WORKTREE_PATH"

# Resolve the base ref. If origin/main isn't fetched, try fetching once
# before failing. For local-only test/dev workflows that don't have a
# remote, fall back to "main" if origin/main can't be resolved.
if ! git rev-parse --verify --quiet "$BASE_BRANCH" >/dev/null; then
	if [[ "$BASE_BRANCH" == origin/* ]]; then
		IFS='/' read -ra parts <<<"$BASE_BRANCH"
		remote="${parts[0]}"
		branch="${parts[1]:-}"
		if [[ -n "$branch" ]] && git remote get-url "$remote" >/dev/null 2>&1; then
			git fetch "$remote" "$branch" 2>/dev/null || true
		fi
	fi
	if ! git rev-parse --verify --quiet "$BASE_BRANCH" >/dev/null; then
		# Try the bare branch name as a fallback (local-only mode).
		if [[ "$BASE_BRANCH" == origin/* ]]; then
			fallback="${BASE_BRANCH#origin/}"
			if git rev-parse --verify --quiet "$fallback" >/dev/null; then
				BASE_BRANCH="$fallback"
			fi
		fi
	fi
	if ! git rev-parse --verify --quiet "$BASE_BRANCH" >/dev/null; then
		echo "Error: '$BASE_BRANCH' not resolvable (locally or after fetch)" >&2
		exit 1
	fi
fi

MERGE_BASE="$(git merge-base "$BASE_BRANCH" HEAD)"

# Union of three sources, dedup, filter to extant files.
CHANGED_FILES="$(
	{
		git diff --name-only "$MERGE_BASE"..HEAD
		git diff --name-only --cached
		git diff --name-only
	} | sort -u | while read -r f; do
		[[ -f "$f" ]] && echo "$f"
	done
)"

# Skip-fast: nothing to check → exit 0 immediately (T10 < 2s).
if [[ -z "$CHANGED_FILES" ]]; then
	echo "[$WORKTREE_NAME] preflight: no changed files vs $BASE_BRANCH — nothing to check."
	exit 0
fi

# Biome-relevant filter (space-separated for direct use in commands).
CHANGED_FILES_BIOME="$(
	echo "$CHANGED_FILES" | grep -E '\.(js|jsx|ts|tsx|css|json|jsonc)$' || true
)"
CHANGED_FILES_BIOME="$(echo "$CHANGED_FILES_BIOME" | tr '\n' ' ' | sed 's/ *$//')"

# preflight_env{} declarative path filters. For each key, glob-match its
# patterns against CHANGED_FILES; export key="1" on any match (or empty).
# Glob-to-regex conversion: ** → .*, * → [^/]*, ? → ., literals escaped.
_glob_to_regex() {
	local p="$1"
	local out=""
	local i=0
	local len=${#p}
	while ((i < len)); do
		local ch="${p:$i:1}"
		case "$ch" in
			'*')
				# Look ahead for **
				if ((i + 1 < len)) && [[ "${p:$i+1:1}" == "*" ]]; then
					out+=".*"
					i=$((i + 2))
				else
					out+="[^/]*"
					i=$((i + 1))
				fi
				;;
			'?')
				out+="."
				i=$((i + 1))
				;;
			'.' | '+' | '(' | ')' | '[' | ']' | '{' | '}' | '|' | '\\' | '^' | '$')
				out+="\\$ch"
				i=$((i + 1))
				;;
			*)
				out+="$ch"
				i=$((i + 1))
				;;
		esac
	done
	echo "^${out}$"
}

# Export declared preflight_env booleans into the environment so preflight
# commands can read them. The names become the env var keys.
PREFLIGHT_ENV_KEYS=()
if jq -e '.preflight_env | type == "object"' "$CONFIG_FILE" >/dev/null 2>&1; then
	mapfile -t PREFLIGHT_ENV_KEYS < <(jq -r '.preflight_env | keys[]' "$CONFIG_FILE")
fi

for key in "${PREFLIGHT_ENV_KEYS[@]}"; do
	matched=""
	mapfile -t patterns < <(jq -r ".preflight_env[\"$key\"][]" "$CONFIG_FILE")
	for pattern in "${patterns[@]}"; do
		regex="$(_glob_to_regex "$pattern")"
		while IFS= read -r f; do
			if [[ "$f" =~ $regex ]]; then
				matched="1"
				break 2
			fi
		done <<<"$CHANGED_FILES"
	done
	# Export the env var. Empty string when no match (so `when: KEY`
	# evaluates as falsy via bash's `-n` check below).
	declare -x "$key=$matched"
done

CHANGED_COUNT="$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')"
BIOME_COUNT="$(echo "$CHANGED_FILES_BIOME" | wc -w | tr -d ' ')"

echo "[$WORKTREE_NAME] preflight — base=$BASE_BRANCH  changed=$CHANGED_COUNT  biome=$BIOME_COUNT"
echo "  $PREFLIGHT_COUNT check(s) declared."

export CHANGED_FILES
export CHANGED_FILES_BIOME

# Run each preflight entry. Skip when `when` is set and falsy.
RAN_COUNT=0
jq -c '.preflight[]' "$CONFIG_FILE" | while IFS= read -r entry; do
	name="$(echo "$entry" | jq -r '.name')"
	command="$(echo "$entry" | jq -r '.command')"
	when="$(echo "$entry" | jq -r '.when // ""')"

	if [[ -n "$when" ]]; then
		# Evaluate `when`: look up the env var of that name.
		when_val="${!when:-}"
		if [[ -z "$when_val" ]]; then
			echo ""
			echo "→ $name (skipped — \$$when is empty)"
			continue
		fi
	fi

	echo ""
	echo "→ $name: $command"
	if ! eval "$command"; then
		echo ""
		echo "[$WORKTREE_NAME] preflight FAILED on: $name" >&2
		exit 1
	fi
	RAN_COUNT=$((RAN_COUNT + 1))
done

echo ""
echo "[$WORKTREE_NAME] preflight passed"
