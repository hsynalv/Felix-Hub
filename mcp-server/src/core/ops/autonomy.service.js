/**
 * Managed autonomy policies — L0–L5 levels per project/env/runbook/schedule.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { evaluateTool } from "../../plugins/policy/policy.engine.js";
import { isDestructiveTool } from "../usage/cost-guardrails.service.js";
import { getTool } from "../tool-registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.AUTONOMY_POLICY_STORE || join(config.catalog?.cacheDir || "./cache", "autonomy-policies.json");

export const AUTONOMY_LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5"];

const DEFAULT_ENV_LEVELS = {
  development: "L3",
  staging: "L2",
  production: "L1",
  test: "L3",
};

const READ_ONLY_TAGS = new Set(["read", "readonly", "observe", "query"]);

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(
      STORE_PATH,
      JSON.stringify({ projects: {}, audit: [] }, null, 2),
      "utf8"
    );
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8"));
  } catch {
    return { projects: {}, audit: [] };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

function isReadOnlyTool(toolName) {
  if (isDestructiveTool(toolName)) return false;
  const tool = getTool(toolName);
  const tags = tool?.tags || [];
  if (tags.some((t) => READ_ONLY_TAGS.has(String(t).toLowerCase()))) return true;
  if (tags.some((t) => String(t).toLowerCase() === "destructive")) return false;
  const name = String(toolName).toLowerCase();
  return (
    name.includes("analyze") ||
    name.includes("summary") ||
    name.includes("search") ||
    name.includes("list") ||
    name.includes("get") ||
    name.includes("read") ||
    name.startsWith("repo_") ||
    name.startsWith("desktop_active") ||
    name.startsWith("desktop_screenshot")
  );
}

export function getDefaultAutonomyLevel(projectEnv = "development") {
  const env = String(projectEnv).toLowerCase();
  return DEFAULT_ENV_LEVELS[env] || "L2";
}

/** Resolve effective autonomy level (explicit > schedule > runbook > project env > default). */
export function resolveAutonomyLevel({
  projectId = null,
  projectEnv = "development",
  runbookId = null,
  scheduleId = null,
  explicitLevel = null,
} = {}) {
  if (explicitLevel && AUTONOMY_LEVELS.includes(explicitLevel)) return explicitLevel;

  const store = readStore();
  const project = projectId ? store.projects?.[projectId] : null;

  if (scheduleId && project?.schedules?.[scheduleId]) {
    return project.schedules[scheduleId];
  }
  if (runbookId && project?.runbooks?.[runbookId]) {
    return project.runbooks[runbookId];
  }
  if (project?.envs?.[projectEnv]) {
    return project.envs[projectEnv];
  }
  if (project?.default) {
    return project.default;
  }

  return getDefaultAutonomyLevel(projectEnv);
}

export function getAutonomyMatrix(projectId = null) {
  const store = readStore();
  const project = projectId ? store.projects?.[projectId] : null;
  const envs = ["development", "staging", "production", "test"];

  return {
    projectId,
    default: project?.default || null,
    envs: Object.fromEntries(
      envs.map((env) => [env, project?.envs?.[env] || getDefaultAutonomyLevel(env)])
    ),
    runbooks: project?.runbooks || {},
    schedules: project?.schedules || {},
    levels: AUTONOMY_LEVELS,
    descriptions: {
      L0: "Observe only — no tool execution",
      L1: "Suggest — read-only analysis tools only",
      L2: "Act with approval — destructive tools require approval",
      L3: "Act within project policy",
      L4: "Scheduled autonomous — within cost/tool limits",
      L5: "Production autonomous with escalation",
    },
  };
}

export function setAutonomyPolicy(
  projectId,
  { default: defaultLevel, envs = {}, runbooks = {}, schedules = {} } = {},
  { actor = "api" } = {}
) {
  if (!projectId) throw Object.assign(new Error("projectId required"), { code: "invalid" });

  const store = readStore();
  const prev = store.projects[projectId] || {};
  const next = {
    default: defaultLevel ?? prev.default ?? null,
    envs: { ...prev.envs, ...envs },
    runbooks: { ...prev.runbooks, ...runbooks },
    schedules: { ...prev.schedules, ...schedules },
    updatedAt: new Date().toISOString(),
  };

  for (const level of [next.default, ...Object.values(next.envs), ...Object.values(next.runbooks), ...Object.values(next.schedules)]) {
    if (level != null && !AUTONOMY_LEVELS.includes(level)) {
      throw Object.assign(new Error(`Invalid autonomy level: ${level}`), { code: "invalid_level" });
    }
  }

  store.projects[projectId] = next;
  store.audit = store.audit || [];
  store.audit.push({
    at: new Date().toISOString(),
    actor,
    projectId,
    action: "set_policy",
    previous: prev,
    next,
  });
  if (store.audit.length > 500) store.audit = store.audit.slice(-500);
  writeStore(store);
  return getAutonomyMatrix(projectId);
}

/** Evaluate whether a run may be spawned at the given autonomy level. */
export function evaluateAutonomyForRunSpawn({
  level,
  projectEnv = "development",
  projectId = null,
  templateId = null,
  estimatedCostUsd = 0,
  maxCostUsd = null,
  source = "manual",
} = {}) {
  const resolved = level || getDefaultAutonomyLevel(projectEnv);
  const reasons = [];
  let allowed = true;
  let requiresApproval = false;
  let requiresEscalation = false;

  if (resolved === "L0") {
    allowed = false;
    reasons.push("L0 observe-only — runs cannot be spawned");
  }

  if (resolved === "L1" && source === "schedule") {
    allowed = false;
    reasons.push("L1 cannot run on schedule — upgrade to L4+");
  }

  const isProduction = String(projectEnv).toLowerCase() === "production";
  if (isProduction && resolved === "L5" && estimatedCostUsd > 5) {
    requiresEscalation = true;
    reasons.push("L5 production run exceeds $5 — escalation required");
  }

  if ((resolved === "L4" || resolved === "L5") && maxCostUsd != null && estimatedCostUsd > maxCostUsd) {
    allowed = false;
    reasons.push(`Estimated cost $${estimatedCostUsd.toFixed(2)} exceeds schedule max $${maxCostUsd}`);
  }

  if (resolved === "L2") {
    requiresApproval = true;
    reasons.push("L2 requires approval before run execution");
  }

  if (resolved === "L3" || resolved === "L4" || resolved === "L5") {
    requiresApproval = false;
  }

  return {
    level: resolved,
    allowed,
    requiresApproval,
    requiresEscalation,
    reasons,
    templateId,
    projectId,
    projectEnv,
    estimatedCostUsd,
    maxCostUsd,
  };
}

/** Runtime tool enforcement by autonomy level. */
export function evaluateAutonomyForTool({
  level,
  toolName,
  projectEnv = "development",
  projectId = null,
  estimatedCostUsd = 0,
  maxCostUsd = null,
} = {}) {
  const resolved = level || getDefaultAutonomyLevel(projectEnv);
  const destructive = isDestructiveTool(toolName);
  const readOnly = isReadOnlyTool(toolName);
  const reasons = [];

  if (resolved === "L0") {
    return { allowed: false, action: "block", level: resolved, reasons: ["L0 observe only"] };
  }

  if (resolved === "L1") {
    if (!readOnly) {
      return { allowed: false, action: "block", level: resolved, reasons: [`L1 allows read-only tools; ${toolName} is not read-only`] };
    }
    return { allowed: true, action: "allow", level: resolved, reasons: [] };
  }

  if (resolved === "L2") {
    if (destructive) {
      return { allowed: false, action: "require_approval", level: resolved, reasons: [`L2 requires approval for destructive tool ${toolName}`] };
    }
    return { allowed: true, action: "allow", level: resolved, reasons: [] };
  }

  if (resolved === "L3") {
    const policy = evaluateTool(toolName, {}, { projectEnv, projectId, user: "autonomy" });
    if (!policy.allowed) {
      return { allowed: false, action: policy.action || "block", level: resolved, reasons: [policy.explanation || policy.message || "Policy denied"] };
    }
    return { allowed: true, action: "allow", level: resolved, reasons: [] };
  }

  if (resolved === "L4" || resolved === "L5") {
    if (maxCostUsd != null && estimatedCostUsd > maxCostUsd) {
      return { allowed: false, action: "block", level: resolved, reasons: [`Cost $${estimatedCostUsd} exceeds max $${maxCostUsd}`] };
    }
    const isProduction = String(projectEnv).toLowerCase() === "production";
    if (isProduction && destructive && resolved === "L4") {
      return { allowed: false, action: "require_approval", level: resolved, reasons: [`L4 blocks destructive tools in production without approval`] };
    }
    const policy = evaluateTool(toolName, {}, { projectEnv, projectId, user: "autonomy" });
    if (!policy.allowed && policy.action === "block") {
      return { allowed: false, action: "block", level: resolved, reasons: [policy.explanation || "Policy denied"] };
    }
    if (!policy.allowed && policy.action === "require_approval") {
      return { allowed: false, action: "require_approval", level: resolved, reasons: [policy.explanation || "Approval required"] };
    }
    if (resolved === "L5" && destructive && isProduction) {
      return { allowed: true, action: "allow", level: resolved, reasons: ["L5 production autonomous with escalation on failure"] };
    }
    return { allowed: true, action: "allow", level: resolved, reasons: [] };
  }

  return { allowed: true, action: "allow", level: resolved, reasons };
}

export function listAutonomyAudit({ projectId = null, limit = 50 } = {}) {
  const store = readStore();
  let entries = store.audit || [];
  if (projectId) entries = entries.filter((e) => e.projectId === projectId);
  return entries.slice(-limit).reverse();
}

export function resetAutonomyForTests() {
  writeStore({ projects: {}, audit: [] });
}
