/**
 * Approval risk scoring (no policy store dependency).
 */

const PROTECTED_TOOLS = new Set([
  "shell_execute",
  "git_push",
  "database_write",
  "workspace_delete_file",
  "desktop_click",
  "desktop_type",
  "sidecar_terminal_exec",
]);

const RISK_WEIGHTS = {
  destructive: 40,
  write: 25,
  needs_approval: 15,
  read_only: 5,
};

export function computeRiskScore({ toolName, riskLevel, tags = [] }) {
  let score = 10;
  if (riskLevel === "destructive") score += 50;
  else if (riskLevel === "write") score += 30;
  else if (riskLevel === "read") score += 5;

  for (const tag of tags) {
    score += RISK_WEIGHTS[tag] ?? 0;
  }
  if (toolName && PROTECTED_TOOLS.has(toolName)) score += 25;
  return Math.min(100, score);
}

export { PROTECTED_TOOLS };
