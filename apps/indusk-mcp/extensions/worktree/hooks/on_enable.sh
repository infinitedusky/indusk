#!/usr/bin/env bash
# on_enable.sh — scaffolds the workbench when `indusk extensions enable
# worktree` runs. Idempotent: safe to re-run via `indusk update`.
#
# What it does:
#   1. Resolves the workbench root (cwd at hook fire time)
#   2. Copies the extension's bash scripts into <workbench>/scripts/worktree/
#      so the workbench owns its own copy (per-workbench tweaks possible;
#      `indusk update` re-copies if upstream changes)
#   3. Registers `wt`, `wt:pm2`, `preflight` scripts in the workbench's
#      package.json (merges, doesn't duplicate)
#   4. Materializes a starter `.indusk/worktree-configs/<wrapped_repo>.json`
#      from the template if absent — substituting WRAPPED_REPO_NAME with
#      the actual repo name from worktree.wrapped_repo config
#
# Requires:
#   - jq installed
#   - .indusk/config.json with worktree.shape == "workbench" + worktree.wrapped_repo
#     (set by `indusk init --workbench` in Phase 6, or hand-edited until then)

set -euo pipefail

EXT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../scripts/lib/workbench-helpers.sh
source "$EXT_DIR/scripts/lib/workbench-helpers.sh"

WORKBENCH_ROOT="$(_resolve_workbench_root)"
export WORKBENCH_ROOT

WRAPPED_REPO="$(_read_workbench_field wrapped_repo)"
if [[ -z "$WRAPPED_REPO" ]]; then
	echo "Warning: .indusk/config.json missing worktree.wrapped_repo." >&2
	echo "Worktree extension is enabled but won't function until that field is set." >&2
	echo "Run 'indusk init --workbench --wrapped-repo <name>' (Phase 6) or hand-edit the config." >&2
	# Don't fail — the extension is enabled, just inert until configured.
fi

echo "Scaffolding worktree extension into $WORKBENCH_ROOT"

# 1. Copy scripts into workbench. Always overwrite — the workbench's copy
# tracks the extension's version, like the hooks dir pattern.
WORKBENCH_SCRIPTS="$WORKBENCH_ROOT/scripts/worktree"
mkdir -p "$WORKBENCH_SCRIPTS/lib"
cp "$EXT_DIR/scripts/setup-worktree.sh" "$WORKBENCH_SCRIPTS/setup-worktree.sh"
cp "$EXT_DIR/scripts/refresh-worktree.sh" "$WORKBENCH_SCRIPTS/refresh-worktree.sh"
cp "$EXT_DIR/scripts/wt.sh" "$WORKBENCH_SCRIPTS/wt.sh"
cp "$EXT_DIR/scripts/wt-pm2.sh" "$WORKBENCH_SCRIPTS/wt-pm2.sh"
cp "$EXT_DIR/scripts/lib/workbench-helpers.sh" "$WORKBENCH_SCRIPTS/lib/workbench-helpers.sh"
chmod +x "$WORKBENCH_SCRIPTS"/*.sh
echo "  scripts: copied into $WORKBENCH_SCRIPTS/"

# 2. Register pnpm scripts in package.json. Merge — don't clobber existing.
PKG_JSON="$WORKBENCH_ROOT/package.json"
if [[ -f "$PKG_JSON" ]]; then
	TMP_PKG="$(mktemp)"
	jq '
		.scripts = (.scripts // {}) + {
			"wt": "bash scripts/worktree/wt.sh",
			"wt:pm2": "bash scripts/worktree/wt-pm2.sh",
			"wt-setup": "bash scripts/worktree/setup-worktree.sh",
			"wt-refresh": "bash scripts/worktree/refresh-worktree.sh"
		}
	' "$PKG_JSON" > "$TMP_PKG"
	mv "$TMP_PKG" "$PKG_JSON"
	echo "  package.json: registered wt, wt:pm2, wt-setup, wt-refresh"
else
	echo "  WARN: no package.json at $PKG_JSON; skipping script registration"
fi

# 3. Materialize starter worktree-config if absent.
if [[ -n "$WRAPPED_REPO" ]]; then
	CONFIG_DIR="$WORKBENCH_ROOT/.indusk/worktree-configs"
	CONFIG_FILE="$CONFIG_DIR/${WRAPPED_REPO}.json"
	if [[ ! -f "$CONFIG_FILE" ]]; then
		mkdir -p "$CONFIG_DIR"
		sed "s/WRAPPED_REPO_NAME/${WRAPPED_REPO}/g" \
			"$EXT_DIR/templates/worktree-config.template.json" > "$CONFIG_FILE"
		echo "  starter config: $CONFIG_FILE"
	else
		echo "  starter config: $CONFIG_FILE already exists, leaving in place"
	fi
fi

echo "Worktree extension scaffolding complete."
