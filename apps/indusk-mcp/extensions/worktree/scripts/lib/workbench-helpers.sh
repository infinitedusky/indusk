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
