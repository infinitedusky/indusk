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
# Where this workbench's repos live, as an absolute path.
#
# DELIBERATE PORT of readReposRoot() + the resolution in resolveReposRoot(),
# src/lib/worktree/repos.ts and bin/commands/workbench.ts. bash cannot import
# them, so the rule is written twice and must move together:
#   repos_root, else sibling_parent, else the workbench's parent;
#   a RELATIVE value resolves against the workbench (that is what makes a
#   nested layout reproduce on another machine); absolute is used as given.
_read_repos_root() {
	local root="${WORKBENCH_ROOT:-}"
	[[ -n "$root" ]] || { echo "Error: _read_repos_root: WORKBENCH_ROOT must be set" >&2; return 1; }
	local declared
	declared="$(_read_workbench_field repos_root)"
	[[ -n "$declared" ]] || declared="$(_read_workbench_field sibling_parent)"
	if [[ -z "$declared" ]]; then
		cd "$root/.." && pwd
		return 0
	fi
	case "$declared" in
		/* | "~"*) _expand_path "$declared" ;;
		*) (cd "$root" && cd "$declared" 2>/dev/null && pwd) || echo "$root/$declared" ;;
	esac
}

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

# Emit "<name>\t<path>" per declared repo. The path is the declared `path`
# (the repo's workbench-side trunk location), or empty meaning `<name>` at the
# workbench root. Same sanitization as the worktrees variant above: relative
# only, no `~`, no `..` in any position — a bad value degrades to the default,
# never to a traversal.
#
# DELIBERATE PORT of repoDir() in src/lib/worktree/repos.ts — bash cannot
# import the TS module, so the rule lives twice and must move together.
_read_workbench_repo_paths() {
	local root="${WORKBENCH_ROOT:-}"
	[[ -n "$root" ]] || { echo "Error: _read_workbench_repo_paths: WORKBENCH_ROOT must be set" >&2; return 1; }
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
			(if (.path | type) == "string"
				and (.path | test("^/|^~|(^|/)\\.\\.(/|$)") | not)
			 then .path else "" end)
		  ])
		| .[] | @tsv
	' "$config" 2>/dev/null || echo ""
}

# Root entries that are never worktrees. ONE definition for the bash lane —
# wt.sh and wt-pm2.sh each carried a copy, and they had already drifted from
# RESERVED_ROOT_DIRS in src/lib/worktree/layout.ts (`docs` was missing from
# both). DELIBERATE PORT of that set; change TS and this together.
_wt_is_reserved_name() {
	case "$1" in
		.indusk | .claude | .vscode | .cursor | node_modules | dist | build | .git | .next | scripts | env | docs) return 0 ;;
		*) return 1 ;;
	esac
}

# Where <repo>'s trunk checkout is, from CONFIG — never from scanning.
#   1. The declared workbench-side location: <workbench>/<path-or-name>,
#      which is the trunk symlink in a linked layout or the real directory in
#      a nested one (`repos_root: "."`).
#   2. Else <repos_root>/<name> — the checkout itself, for a workbench whose
#      trunk link was never made. Routing there is what "the config says where
#      things are" means; failing because a symlink is missing is scan-luck.
_wt_resolve_trunk_dir() {
	local repo="$1"
	local declared_path="" name path
	while IFS=$'\t' read -r name path; do
		[[ "$name" == "$repo" ]] || continue
		declared_path="$path"
		break
	done < <(_read_workbench_repo_paths)
	local side="$WORKBENCH_ROOT/${declared_path:-$repo}"
	if [[ -d "$side" ]]; then
		echo "$side"
		return 0
	fi
	local repos_root
	repos_root="$(_read_repos_root)" || return 1
	if [[ -d "$repos_root/$repo" ]]; then
		echo "$repos_root/$repo"
		return 0
	fi
	echo "Error: trunk for repo '$repo' not found — looked at $side and $repos_root/$repo. Run \`indusk workbench restore\`." >&2
	return 1
}

# _wt_resolve_target <slug-or-qualified-slug> — the ONE resolution surface
# behind `pnpm wt` and `pnpm wt:pm2`. Each script carried its own copy once,
# and only one of them learned declared layouts — wt-pm2.sh stayed root-only
# for a full release while its header claimed "resolution matches wt.sh".
#
# Order:
#   1. Trunks, from config: `main` (qualified `<repo>/main` when several repos
#      are declared) or a declared repo name routes via _wt_resolve_trunk_dir.
#   2. Worktrees, by scanning the workbench root and every DECLARED worktrees
#      directory. Exact match wins; `-<slug>` suffix as fallback; ambiguity
#      refuses and names the qualified `<repo>/<slug>` forms.
#
# Echoes the resolved absolute path. Errors to stderr, non-zero return.
_wt_resolve_target() {
	local target="$1"
	local qualifier="" slug="$target"
	if [[ "$slug" == */* ]]; then
		qualifier="${slug%%/*}"
		slug="${slug#*/}"
	fi

	local repos=() r
	while IFS= read -r r; do
		[[ -n "$r" ]] && repos+=("$r")
	done < <(_read_workbench_repos)

	# --- 1. trunks come from config, never from scanning ---
	if [[ "$slug" == "main" ]]; then
		local repo=""
		if [[ -n "$qualifier" ]]; then
			if [[ ${#repos[@]} -gt 0 ]]; then
				for r in "${repos[@]}"; do
					[[ "$r" == "$qualifier" ]] && repo="$r"
				done
			fi
			if [[ -z "$repo" ]]; then
				echo "Error: no declared repo named '$qualifier' in .indusk/config.json." >&2
				return 1
			fi
		elif [[ ${#repos[@]} -eq 1 ]]; then
			repo="${repos[0]}"
		elif [[ ${#repos[@]} -gt 1 ]]; then
			echo "Error: 'main' is ambiguous — this workbench declares several repos:" >&2
			for r in "${repos[@]}"; do printf '  %s/main\n' "$r" >&2; done
			return 1
		else
			echo "Error: no repos declared in .indusk/config.json — not a workbench?" >&2
			return 1
		fi
		_wt_resolve_trunk_dir "$repo"
		return $?
	fi

	if [[ ${#repos[@]} -gt 0 && ( -z "$qualifier" || "$qualifier" == "$slug" ) ]]; then
		for r in "${repos[@]}"; do
			if [[ "$r" == "$slug" ]]; then
				_wt_resolve_trunk_dir "$r"
				return $?
			fi
		done
	fi

	# --- 2. worktrees, from the root and every declared worktrees dir ---
	local search_repos=() search_dirs=() _name _dir
	while IFS=$'\t' read -r _name _dir; do
		[[ -n "$_name" ]] || continue
		# Only DECLARED directories get their own pass — the root pass below
		# covers repos that declare none (the flat layout). Searching the root
		# twice turned every flat-layout slug into a false ambiguity.
		[[ -n "$_dir" ]] || continue
		search_repos+=("$_name")
		search_dirs+=("$_dir")
	done < <(_read_workbench_worktree_dirs)
	search_repos+=("")
	search_dirs+=("")

	local exact_paths=() exact_repos=() suffix_paths=() suffix_repos=()
	local idx repo dir base entry name
	for idx in "${!search_dirs[@]}"; do
		repo="${search_repos[$idx]}"
		dir="${search_dirs[$idx]}"
		if [[ -n "$qualifier" && -n "$repo" && "$repo" != "$qualifier" ]]; then continue; fi
		if [[ -n "$qualifier" && -z "$repo" ]]; then continue; fi
		base="$WORKBENCH_ROOT"
		[[ -n "$dir" ]] && base="$WORKBENCH_ROOT/$dir"
		[[ -d "$base" ]] || continue
		for entry in "$base"/*; do
			[[ -e "$entry" ]] || continue
			[[ -d "$entry" ]] || continue
			name="$(basename "$entry")"
			[[ -z "$dir" ]] && _wt_is_reserved_name "$name" && continue
			if [[ "$name" == "$slug" ]]; then
				exact_paths+=("$entry"); exact_repos+=("$repo")
			elif [[ "$name" == *"-$slug" ]]; then
				suffix_paths+=("$entry"); suffix_repos+=("$repo")
			fi
		done
	done

	local candidate_paths=() candidate_repos=()
	if [[ ${#exact_paths[@]} -gt 0 ]]; then
		candidate_paths=("${exact_paths[@]}"); candidate_repos=("${exact_repos[@]}")
	elif [[ ${#suffix_paths[@]} -gt 0 ]]; then
		candidate_paths=("${suffix_paths[@]}"); candidate_repos=("${suffix_repos[@]}")
	fi

	if [[ ${#candidate_paths[@]} -eq 0 ]]; then
		echo "Error: no worktree or trunk matching slug '$slug' at $WORKBENCH_ROOT" >&2
		echo "Available targets:" >&2
		if [[ ${#repos[@]} -gt 0 ]]; then
			for r in "${repos[@]}"; do
				if [[ ${#repos[@]} -eq 1 ]]; then
					printf '  %s (trunk — also `wt main`)\n' "$r" >&2
				else
					printf '  %s (trunk — also `wt %s/main`)\n' "$r" "$r" >&2
				fi
			done
		fi
		for idx in "${!search_dirs[@]}"; do
			repo="${search_repos[$idx]}"; dir="${search_dirs[$idx]}"
			base="$WORKBENCH_ROOT"; [[ -n "$dir" ]] && base="$WORKBENCH_ROOT/$dir"
			[[ -d "$base" ]] || continue
			for entry in "$base"/*; do
				[[ -d "$entry" ]] || continue
				name="$(basename "$entry")"
				[[ -z "$dir" ]] && _wt_is_reserved_name "$name" && continue
				if [[ -n "$repo" ]]; then printf '  %s/%s\n' "$repo" "$name" >&2; else printf '  %s\n' "$name" >&2; fi
			done
		done
		return 1
	fi

	if [[ ${#candidate_paths[@]} -gt 1 ]]; then
		echo "Error: multiple targets match slug '$slug':" >&2
		local i
		for i in "${!candidate_paths[@]}"; do
			if [[ -n "${candidate_repos[$i]}" ]]; then
				printf '  %s/%s\n' "${candidate_repos[$i]}" "$(basename "${candidate_paths[$i]}")" >&2
			else
				printf '  %s\n' "$(basename "${candidate_paths[$i]}")" >&2
			fi
		done
		echo "Name the repo to disambiguate, e.g. \`wt <repo>/$slug\`." >&2
		return 1
	fi

	echo "${candidate_paths[0]}"
}
