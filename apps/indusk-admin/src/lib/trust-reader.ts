import { isTrusted } from "@infinitedusky/indusk-mcp/session";

/**
 * Whether Claude Code trusts a project's root (workbench-plan-authoring
 * D12): its own record, read through the package. Pages read it here so a
 * browser test mocks one module.
 */
export function projectTrusted(root: string): boolean {
  return isTrusted(root);
}
