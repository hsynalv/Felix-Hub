/**
 * Multi-agent role definitions and tool access policies.
 */

export const AGENT_ROLES = {
  planner: {
    label: "Planner",
    description: "Breaks goals into steps and delegates work.",
    allowedToolPrefixes: ["agent_", "brain_", "project_"],
    maxAutonomy: "L3",
  },
  executor: {
    label: "Executor",
    description: "Runs tools and integrations.",
    allowedToolPrefixes: ["*"],
    maxAutonomy: "L4",
  },
  reviewer: {
    label: "Reviewer",
    description: "Validates outputs and approves handoffs.",
    allowedToolPrefixes: ["agent_", "audit_", "eval_"],
    maxAutonomy: "L2",
  },
  researcher: {
    label: "Researcher",
    description: "Gathers context from knowledge and web.",
    allowedToolPrefixes: ["brain_", "tavily_", "notion_", "obsidian_"],
    maxAutonomy: "L3",
  },
};

export function listAgentRoles() {
  return Object.entries(AGENT_ROLES).map(([id, def]) => ({ id, ...def }));
}

export function getAgentRole(roleId) {
  return AGENT_ROLES[roleId] ? { id: roleId, ...AGENT_ROLES[roleId] } : null;
}

export function roleAllowsTool(roleId, toolName) {
  const role = AGENT_ROLES[roleId];
  if (!role) return true;
  const prefixes = role.allowedToolPrefixes || [];
  if (prefixes.includes("*")) return true;
  return prefixes.some((p) => toolName.startsWith(p));
}
