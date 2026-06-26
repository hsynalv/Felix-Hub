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
  "release-manager": {
    id: "release-manager",
    name: "Release Manager",
    description:
      "Merged PR analizi → changelog → semver önerisi → migration risk → test checklist → release branch → draft release onayı.",
    parameters: [
      { name: "repo", type: "string", required: true, description: "GitHub repo (owner/name)" },
      { name: "sinceTag", type: "string", required: false, default: "v0.0.0", description: "Önceki release tag" },
      { name: "baseBranch", type: "string", required: false, default: "main" },
      { name: "releaseBranch", type: "string", required: false, default: "release/next" },
      { name: "changelogFormat", type: "string", required: false, default: "keep-a-changelog" },
    ],
    steps: [
      { type: "tool", toolName: "repo_analyze", args: { repo: "{{repo}}" }, maxRetries: 1 },
      { type: "tool", toolName: "github_pr_list", args: { repo: "{{repo}}", state: "closed", limit: 50 } },
      { type: "checkpoint", name: "changelog-review" },
      { type: "approval", name: "release-approval", message: "Production release için onay gerekir" },
      {
        type: "tool",
        toolName: "github_branch_create",
        args: { repo: "{{repo}}", branch: "{{releaseBranch}}", base: "{{baseBranch}}", explanation: "Open release branch" },
      },
      { type: "tool", toolName: "tests_run", args: { path: "." }, maxRetries: 1 },
      { type: "tool", toolName: "git_status", args: {} },
    ],
  },
  "dependency-maintenance": {
    id: "dependency-maintenance",
    name: "Dependency & Security Maintenance",
    description: "Outdated + vulnerability scan → risk skoru → güvenli update PR önerisi → test.",
    parameters: [
      { name: "repo", type: "string", required: true },
      { name: "workspacePath", type: "string", required: false, default: "." },
      { name: "ecosystem", type: "string", required: false, default: "npm" },
      { name: "maxRiskScore", type: "number", required: false, default: "70" },
    ],
    steps: [
      { type: "tool", toolName: "repo_analyze", args: { repo: "{{repo}}" } },
      { type: "tool", toolName: "workspace_list", args: { path: "{{workspacePath}}" } },
      { type: "checkpoint", name: "scan-results" },
      { type: "approval", name: "high-risk-update", message: "Yüksek riskli güncelleme için ek onay" },
      { type: "tool", toolName: "tests_run", args: { path: "{{workspacePath}}" }, maxRetries: 1 },
      {
        type: "tool",
        toolName: "github_pr_create",
        args: {
          repo: "{{repo}}",
          title: "chore(deps): safe dependency updates",
          head: "deps/maintenance",
          base: "main",
          body: "Automated maintenance scan update PR",
          explanation: "Propose safe dependency updates",
        },
      },
    ],
  },
  "workspace-hygiene": {
    id: "workspace-hygiene",
    name: "Workspace Hygiene",
    description: "Stale PR/branch, TODO taraması, eski failed run raporu — destructive cleanup onaylı.",
    parameters: [
      { name: "repo", type: "string", required: true },
      { name: "workspacePath", type: "string", required: false, default: "." },
      { name: "stalePrDays", type: "number", required: false, default: "30" },
      { name: "archiveRunDays", type: "number", required: false, default: "90" },
    ],
    steps: [
      { type: "tool", toolName: "github_pr_list", args: { repo: "{{repo}}", state: "open", limit: 50 } },
      { type: "tool", toolName: "git_branch_list", args: {} },
      { type: "tool", toolName: "workspace_search", args: { query: "TODO|FIXME", path: "{{workspacePath}}", limit: 30 } },
      { type: "tool", toolName: "repo_summary", args: { repo: "{{repo}}" } },
      { type: "checkpoint", name: "hygiene-report" },
      { type: "approval", name: "destructive-cleanup", message: "Branch silme / PR kapatma için onay" },
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
