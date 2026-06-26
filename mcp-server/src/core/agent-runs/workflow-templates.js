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
  "ci-failure-heal": {
    id: "ci-failure-heal",
    name: "CI failure heal",
    description:
      "CI/test failure analizi → dosya inceleme → patch önerisi → test → PR özeti.",
    parameters: [
      { name: "repo", type: "string", required: true, description: "GitHub repo (owner/name)" },
      { name: "branch", type: "string", required: false, default: "main" },
      { name: "checkName", type: "string", required: false, default: "CI" },
      { name: "failureLog", type: "string", required: false, description: "CI log excerpt" },
      { name: "workspacePath", type: "string", required: false, default: "." },
      { name: "testCommand", type: "string", required: false, default: "npm test" },
    ],
    steps: [
      { type: "tool", toolName: "repo_analyze", args: { repo: "{{repo}}" }, maxRetries: 1 },
      { type: "tool", toolName: "repo_recent_commits", args: { repo: "{{repo}}", limit: 5 } },
      { type: "checkpoint", name: "analyze-failure" },
      { type: "tool", toolName: "workspace_list", args: { path: "{{workspacePath}}" } },
      { type: "tool", toolName: "git_status", args: {} },
      { type: "tool", toolName: "git_diff", args: {} },
      { type: "tool", toolName: "code_review_suggest_fix", args: { issue: { message: "{{failureLog}}" }, code: "{{failureLog}}" } },
      { type: "approval", name: "apply-fix", message: "Önerilen düzeltmeyi uygulamak için onay gerekir" },
      { type: "tool", toolName: "tests_run", args: { path: "{{workspacePath}}" }, maxRetries: 1 },
      { type: "tool", toolName: "git_add", args: { paths: ["."], explanation: "Stage CI fix" } },
      { type: "tool", toolName: "git_commit", args: { message: "fix(ci): resolve {{checkName}} failure", explanation: "Commit CI fix" } },
      {
        type: "tool",
        toolName: "github_pr_create",
        args: {
          repo: "{{repo}}",
          title: "fix(ci): {{checkName}} on {{branch}}",
          head: "{{branch}}",
          base: "main",
          body: "Automated CI failure heal run",
        },
      },
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
