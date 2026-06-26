/**
 * Multi-agent parent/child run orchestration (V6.1).
 */

import { createRun, getRun, listRuns, listRunSteps } from "../agent-runs/agent-runs.service.js";
import { createRunFromTemplate } from "../agent-runs/run-orchestrator.js";
import { getAgentRole, roleAllowsTool } from "./agent-roles.js";

export async function createParentRun({ goal, projectId, conversationId, createdBy, metadata = {} } = {}) {
  if (!goal) {
    throw Object.assign(new Error("goal required"), { code: "invalid" });
  }
  return createRun({
    goal,
    projectId: projectId || null,
    conversationId: conversationId || null,
    createdBy: createdBy || "api",
    metadata: {
      multiAgent: true,
      runKind: "parent",
      ...metadata,
    },
  });
}

export async function spawnChildRun(
  parentRunId,
  { role = "executor", goal = null, handoff = {}, skillId = null, templateId = null, projectId, createdBy, dryRun = false, parameters = {} } = {}
) {
  const parent = await getRun(parentRunId);
  if (!parent) {
    throw Object.assign(new Error(`Parent run not found: ${parentRunId}`), { code: "not_found" });
  }

  const roleDef = getAgentRole(role);
  if (!roleDef) {
    throw Object.assign(new Error(`Unknown role: ${role}`), { code: "invalid_role" });
  }

  const childGoal = goal || `${roleDef.label}: ${parent.goal || "child task"}`;
  const metadata = {
    multiAgent: true,
    runKind: "child",
    parentRunId,
    role,
    handoff,
    skillId,
    templateId,
    dryRun,
  };

  if (templateId) {
    return createRunFromTemplate(templateId, { goal: childGoal, ...parameters, handoff }, {
      projectId: projectId || parent.projectId,
      createdBy: createdBy || "multi-agent",
      dryRun,
      metadataExtra: metadata,
    });
  }

  return createRun({
    goal: childGoal,
    projectId: projectId || parent.projectId,
    conversationId: parent.conversationId,
    createdBy: createdBy || "multi-agent",
    metadata: metadata,
  });
}

export async function listChildRuns(parentRunId, { limit = 50 } = {}) {
  return listRuns({ parentRunId, limit });
}

export async function getParentAggregate(parentRunId) {
  const parent = await getRun(parentRunId);
  if (!parent) return null;

  const children = await listChildRuns(parentRunId, { limit: 100 });
  const childSummaries = await Promise.all(
    children.map(async (child) => {
      const steps = await listRunSteps(child.id);
      return {
        id: child.id,
        role: child.metadata?.role || null,
        status: child.status,
        goal: child.goal,
        stepCount: steps.length,
        skillId: child.metadata?.skillId || null,
        templateId: child.metadata?.templateId || null,
        startedAt: child.startedAt,
        finishedAt: child.finishedAt,
      };
    })
  );

  const completed = children.filter((c) => c.status === "completed").length;
  const failed = children.filter((c) => c.status === "failed").length;
  const running = children.filter((c) => c.status === "running").length;

  return {
    parent,
    children: childSummaries,
    summary: {
      totalChildren: children.length,
      completed,
      failed,
      running,
      roles: [...new Set(childSummaries.map((c) => c.role).filter(Boolean))],
    },
  };
}

export function evaluateChildToolAccess(childRun, toolName) {
  const role = childRun?.metadata?.role;
  if (!role) return { allowed: true };
  const allowed = roleAllowsTool(role, toolName);
  return {
    allowed,
    role,
    reason: allowed ? null : `Role ${role} cannot invoke ${toolName}`,
  };
}
