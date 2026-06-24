import { apiGetRaw, apiPost, apiDelete } from "./api-client";

export interface PolicyRule {
  id: string;
  pattern?: string | null;
  toolPattern?: string | null;
  environment?: string | null;
  projectId?: string | null;
  action: string;
  description?: string;
  enabled?: boolean;
}

export async function listPolicyRules() {
  const res = await apiGetRaw<{ rules?: PolicyRule[]; data?: { rules?: PolicyRule[] } }>("/policy/rules");
  return res.rules ?? res.data?.rules ?? [];
}

export async function createPolicyRule(rule: Partial<PolicyRule>) {
  return apiPost<{ rule: PolicyRule }>("/policy/rules", rule);
}

export async function deletePolicyRule(id: string) {
  return apiDelete(`/policy/rules/${id}`);
}

export async function evaluatePolicy(body: {
  toolName?: string;
  method?: string;
  path?: string;
  body?: unknown;
  environment?: string;
  projectId?: string;
}) {
  return apiPost<{ result: Record<string, unknown> }>("/policy/evaluate", body);
}

export async function getPolicySuggestions() {
  const res = await apiGetRaw<{ suggestions?: Array<{ tool: string; rejectCount: number; suggestedRule: Partial<PolicyRule> }> }>(
    "/policy/suggestions"
  );
  return { suggestions: res.suggestions ?? [] };
}

export async function dryRunTool(toolName: string, args: Record<string, unknown>) {
  return apiPost(`/tools/${toolName}/dry-run`, { arguments: args });
}
