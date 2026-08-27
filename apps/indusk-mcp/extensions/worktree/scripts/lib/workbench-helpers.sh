#!/usr/bin/env bash
# workbench-helpers.sh — shared functions for the worktree extension's
# bash scripts. NOT executable directly; sourced by setup-worktree.sh,
# refresh-worktree.sh, wt.sh, etc.
#
# Public functions:
#   _resolve_workbench_root [start_dir]
#       Walks up from start_dir (default: cwd) looking for a directory
#       containing .indusk/config.json with worktree.shape == "workbench".
#       Echoes the absolute path on success; exits non-zero on failure.
#
#   _read_workbench_field <field>
#       Reads a top-level worktree.<field> value from the workbench's
#       .indusk/config.json. Echoes the value (empty string if unset).
#       Caller is responsible for calling _resolve_workbench_root first
#       and cd'ing or passing the path explicitly via WORKBENCH_ROOT env.
#
#   _read_workbench_repos
#       Echoes the declared repo names, one per line, in declared order.
#       DELIBERATE PORT of readWorkbenchRepos() in
#       src/lib/worktree/repos.ts — bash cannot import the TS module, so
#       the reduction lives in two places and they change together.
#       `worktree.repos[]` is canonical; the legacy `worktree.wrapped_repo`
#       reduces to a one-element list. Names that are not clean path
#       segments are dropped and duplicates collapse to first occurrence,
#       because every caller joins these into a filesystem path.
#
#   _resolve_workbench_repo [requested]
#       Echoes the one repo the caller means. With `requested` it must
#       match a declared repo. Without it, a single declared repo is
#       implied; with several, this FAILS and names the candidates on
#       stderr rather than picking one — putting a worktree in the wrong
#       repo looks exactly like success until someone reads the branch.
#
#   _read_worktree_config <repo> <jq-filter>
#       Reads a value from .indusk/worktree-configs/<repo>.json using the
#       provided jq filter. Echoes the value or empty string if config
#       is missing.
#
#   _expand_path <path>
#       Expands a ~/ prefix and normalizes the path. echo's the absolute
#       form. Pure string operation — does NOT check the path exists.
#
# Assumptions:
#   - bash >= 3.2 (macOS default)
#   - jq is installed (the worktree extension's manifest will document this)

# Strict-mode helper — caller scripts use `set -euo pipefail`; this file
# defines functions, so doesn't set its own.

_expand_path() {
	local p="$1"
	# Expand a literal `~/` prefix to $HOME. Leaves other paths untouched.
	if [[ "$p" == "~"* ]]; then
		p="${HOME}${p#"~"}"
	fi
	echo "$p"
}

_resolve_workbench_root() {
	local cur="${1:-$PWD}"
	cur="$(cd "$cur" 2>/dev/null && pwd)" || {
		echo "Error: _resolve_workbench_root: start dir does not exist" >&2
		return 1
	}
	# Walk up to filesystem root looking for a workbench-shaped .indusk/config.json
	while [[ "$cur" != "/" && -n "$cur" ]]; do
		local config="$cur/.indusk/config.json"
		if [[ -f "$config" ]]; then
			local shape
			shape="$(jq -r '.worktree.shape // ""' "$config" 2>/dev/null || echo "")"
			if [[ "$shape" == "workbench" ]]; then
				echo "$cur"
				return 0
			fi
		fi
		cur="$(dirname "$cur")"
	done
	echo "Error: _resolve_workbench_root: no workbench-shaped .indusk/config.json found walking up from ${1:-$PWD}" >&2
	return 1
}

_read_workbench_field() {
	local field="$1"
	local root="${WORKBENCH_ROOT:-}"
	if [[ -z "$root" ]]; then
		echo "Error: _read_workbench_field: WORKBENCH_ROOT must be set" >&2
		return 1
	fi
	local config="$root/.indusk/config.json"
	if [[ ! -f "$config" ]]; then
		echo "Error: _read_workbench_field: $config not found" >&2
		return 1
	fi
	jq -r ".worktree.${field} // \"\"" "$config" 2>/dev/null || echo ""
}

_read_workbench_repos() {
	local root="${WORKBENCH_ROOT:-}"
	if [[ -z "$root" ]]; then
		echo "Error: _read_workbench_repos: WORKBENCH_ROOT must be set" >&2
		return 1
	fi
	local config="$root/.indusk/config.json"
	if [[ ! -f "$config" ]]; then
		echo "Error: _read_workbench_repos: $config not found" >&2
		return 1
	fi
	# The reduction, in jq. `unique` is deliberately NOT used: it sorts, and
	# declared order is meaningful (the first repo is the implied one at N=1).
	jq -r '
		(.worktree // {}) as $w
		| (
			if ($w.repos | type) == "array" then $w.repos
			elif ($w.wrapped_repo | type) == "string" then [{ name: $w.wrapped_repo }]
			else []
			end
		)
		| map(select(type == "object"))
		| map(.name)
		| map(select(type == "string"))
		| map(select(. != "" and . != "." and . != ".." and (contains("/") | not) and (contains("\\") | not)))
		| reduce .[] as $n ([]; if (index($n) == null) then . + [$n] else . end)
		| .[]
	' "$config" 2>/dev/null || echo ""
}

# Emit "<name>\t<worktrees-dir>" per declared repo. The dir is the declared
# `worktrees` value, or empty meaning the workbench root — absence is the flat
# layout, which is what every workbench had before layouts could be declared.
#
# DELIBERATE PORT of the same reduction readWorkbenchRepos() performs in
# src/lib/worktree/repos.ts — bash cannot import the TS module. Keep the two in
# step: the accepted shape of `worktrees` is a relative path inside the
# workbench, so it may contain "/" but may never escape.
_read_workbench_worktree_dirs() {
	local root="${WORKBENCH_ROOT:-}"
	[[ -n "$root" ]] || { echo "Error: _read_workbench_worktree_dirs: WORKBENCH_ROOT must be set" >&2; return 1; }
	local config="$root/.indusk/config.json"
	[[ -f "$config" ]] || return 0
	jq -r '
		(.worktree // {}) as $w
		| (
			if ($w.repos | type) == "array" then $w.repos
			elif ($w.wrapped_repo | type) == "string" then [{ name: $w.wrapped_repo }]
			else []
			end
		)
		| map(select(type == "object"))
		| map(select((.name | type) == "string" and .name != ""))
		| map([
			.name,
			(if (.worktrees | type) == "string"
				and (.worktrees | test("^/|^~|(^|/)\\.\\.(/|$)") | not)
			 then .worktrees else "" end)
		  ])
		| .[] | @tsv
	' "$config" 2>/dev/null || echo ""
}

_resolve_workbench_repo() {
	local requested="${1:-}"
	local repos=()
	while IFS= read -r line; do
		[[ -n "$line" ]] && repos+=("$line")
	done < <(_read_workbench_repos)

	if [[ ${#repos[@]} -eq 0 ]]; then
		echo "Error: this project is not a workbench (set worktree.shape=\"workbench\" and worktree.repos[] in .indusk/config.json, or run \`indusk init --workbench\`)." >&2
		return 1
	fi

	local joined
	joined="$(printf '%s, ' "${repos[@]}")"
	joined="${joined%, }"

	if [[ -n "$requested" ]]; then
		local r
		for r in "${repos[@]}"; do
			if [[ "$r" == "$requested" ]]; then
				echo "$r"
				return 0
			fi
		done
		echo "Error: no declared repo named \"$requested\". This workbench declares: ${joined}." >&2
		return 1
	fi

	if [[ ${#repos[@]} -eq 1 ]]; then
		echo "${repos[0]}"
		return 0
	fi

	echo "Error: this workbench declares more than one repo, so the repo must be named: ${joined}." >&2
	return 1
}

_read_worktree_config() {
	local repo="$1"
	local filter="$2"
	local root="${WORKBENCH_ROOT:-}"
	if [[ -z "$root" ]]; then
		echo "Error: _read_worktree_config: WORKBENCH_ROOT must be set" >&2
		return 1
	fi
	local config="$root/.indusk/worktree-configs/${repo}.json"
	if [[ ! -f "$config" ]]; then
		echo "Error: _read_worktree_config: $config not found" >&2
		return 1
	fi
	jq -r "$filter" "$config" 2>/dev/null
}
