/**
 * Workflow templates — predefined multi-step agent runs.
 */

import { expandWorkflowSteps } from "./workflow-expr.js";

export const WORKFLOW_TEMPLATES = {
  "repo-ship-feature": {
    id: "repo-ship-feature",
    name: "Repo → Feature → PR",
    description:
      "Repo analizi, issue kontrolü, branch oluşturma, durum kontrolü ve PR açma — tek run_id altında.",
    parameters: [
      { name: "repo", type: "string", required: true, description: "GitHub repo (owner/name)" },
      { name: "branch", type: "string", required: true, description: "Feature branch adı" },
      { name: "goal", type: "string", required: false, description: "Özellik hedefi özeti" },
      { name: "baseBranch", type: "string", required: false, default: "main" },
      { name: "skipIssues", type: "boolean", required: false, default: "false", description: "Issue adımını atla" },
    ],
    steps: [
      { type: "tool", toolName: "repo_analyze", args: { repo: "{{repo}}" }, maxRetries: 1 },
      { type: "tool", toolName: "repo_open_issues", args: { repo: "{{repo}}", limit: 5 }, when: "{{skipIssues}} !== true" },
      { type: "checkpoint", name: "pre-branch" },
      { type: "tool", toolName: "git_branch_create", args: { name: "{{branch}}" } },
      { type: "tool", toolName: "git_status", args: {} },
      {
        type: "tool",
        toolName: "github_branch_create",
        args: { repo: "{{repo}}", branch: "{{branch}}", from: "{{baseBranch}}" },
        compensate: { toolName: "git_status", args: {} },
      },
      { type: "tool", toolName: "github_pr_create", args: { repo: "{{repo}}", title: "{{goal}}", head: "{{branch}}", base: "{{baseBranch}}" } },
    ],
  },
  "incident-triage": {
    id: "incident-triage",
    name: "Incident triage",
    description: "Repo özeti, son commitler ve açık issue'lar — hızlı durum tespiti.",
    parameters: [
      { name: "repo", type: "string", required: true },
    ],
    steps: [
      { type: "tool", toolName: "repo_summary", args: { repo: "{{repo}}" } },
      { type: "tool", toolName: "repo_recent_commits", args: { repo: "{{repo}}", limit: 10 } },
      { type: "tool", toolName: "repo_open_issues", args: { repo: "{{repo}}", limit: 10 } },
    ],
  },
};

export function listWorkflowTemplates() {
  return Object.values(WORKFLOW_TEMPLATES).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    stepCount: t.steps.length,
    parameters: t.parameters,
  }));
}

export function getWorkflowTemplate(id) {
  return WORKFLOW_TEMPLATES[id] || null;
}

/** Replace {{param}} placeholders in step args. */
export function resolveTemplateArgs(templateValue, params) {
  if (typeof templateValue === "string") {
    return templateValue.replace(/\{\{(\w+)\}\}/g, (_, key) => String(params[key] ?? ""));
  }
  if (Array.isArray(templateValue)) {
    return templateValue.map((v) => resolveTemplateArgs(v, params));
  }
  if (templateValue && typeof templateValue === "object") {
    const out = {};
    for (const [k, v] of Object.entries(templateValue)) {
      out[k] = resolveTemplateArgs(v, params);
    }
    return out;
  }
  return templateValue;
}

export function buildPlanFromTemplate(template, params) {
  const expanded = expandWorkflowSteps(template.steps, params);
  return {
    templateId: template.id,
    parameters: params,
    phases: expanded.map((step, index) => ({
      index,
      type: step.type,
      toolName: step.toolName,
      args: step.args || {},
      when: step.when,
      maxRetries: step.maxRetries,
      compensate: step.compensate,
      name: step.name,
    })),
  };
}
