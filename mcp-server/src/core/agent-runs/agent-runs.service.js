/**
 * Agent runs persistence — MSSQL with in-memory fallback.
 */

import {
  persistenceQuery,
  isPersistenceHealthy,
  randomUUID,
} from "../persistence/index.js";
import { maskBody } from "../audit.js";
import { emitRunEvent } from "./run-events.js";

export const RunStatus = {
  PENDING: "pending",
  RUNNING: "running",
  WAITING_APPROVAL: "waiting_approval",
  PAUSED: "paused",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

export const StepType = {
  LLM: "llm",
  TOOL: "tool",
  APPROVAL: "approval",
  SYSTEM: "system",
};

/** @type {Map<string, object>} */
const memoryRuns = new Map();
/** @type {Map<string, object[]>} */
const memorySteps = new Map();
/** @type {Map<string, object[]>} */
const memoryCheckpoints = new Map();

function useMemory() {
  return !isPersistenceHealthy();
}

function parseJson(val) {
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

function stringifyJson(val) {
  if (val == null) return null;
  try {
    return JSON.stringify(val);
  } catch {
    return null;
  }
}

function maskJson(obj) {
  if (!obj || typeof obj !== "object") return obj;
  return maskBody(obj);
}

function rowToRun(row, stepCount = 0) {
  return {
    id: row.id,
    projectId: row.project_id || null,
    conversationId: row.conversation_id || null,
    goal: row.goal || null,
    status: row.status,
    currentStep: row.current_step ?? 0,
    plan: parseJson(row.plan_json),
    metadata: parseJson(row.metadata_json),
    createdBy: row.created_by || null,
    error: parseJson(row.error_json),
    startedAt: row.started_at || null,
    finishedAt: row.finished_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stepCount,
  };
}

function rowToStep(row) {
  return {
    id: row.id,
    runId: row.run_id,
    stepIndex: row.step_index,
    type: row.step_type,
    toolName: row.tool_name || null,
    status: row.status,
    input: parseJson(row.input_json),
    output: parseJson(row.output_json),
    durationMs: row.duration_ms ?? null,
    retryCount: row.retry_count ?? 0,
    usage: parseJson(row.usage_json),
    metadata: parseJson(row.metadata_json),
    createdAt: row.created_at,
  };
}

async function nextStepIndex(runId) {
  if (useMemory()) {
    const steps = memorySteps.get(runId) || [];
    return steps.length;
  }
  const result = await persistenceQuery(
    `SELECT ISNULL(MAX(step_index), -1) + 1 AS next_index FROM agent_run_steps WHERE run_id = @runId`,
    { runId }
  );
  return result.recordset[0]?.next_index ?? 0;
}

export async function createRun({
  goal = null,
  projectId = null,
  conversationId = null,
  createdBy = null,
  metadata = null,
  plan = null,
} = {}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const run = {
    id,
    projectId,
    conversationId,
    goal,
    status: RunStatus.RUNNING,
    currentStep: 0,
    plan,
    metadata,
    createdBy,
    error: null,
    startedAt: now,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
    stepCount: 0,
  };

  if (useMemory()) {
    memoryRuns.set(id, { ...run });
    memorySteps.set(id, []);
    memoryCheckpoints.set(id, []);
    return run;
  }

  await persistenceQuery(
    `INSERT INTO agent_runs (id, project_id, conversation_id, goal, status, current_step, plan_json, metadata_json, created_by, started_at, created_at, updated_at)
     VALUES (@id, @projectId, @conversationId, @goal, @status, 0, @planJson, @metadataJson, @createdBy, SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME())`,
    {
      id,
      projectId,
      conversationId,
      goal,
      status: RunStatus.RUNNING,
      planJson: stringifyJson(plan),
      metadataJson: stringifyJson(metadata),
      createdBy,
    }
  );
  return run;
}

export async function findActiveRunForConversation(conversationId) {
  if (!conversationId) return null;

  if (useMemory()) {
    for (const run of memoryRuns.values()) {
      if (
        run.conversationId === conversationId &&
        [RunStatus.RUNNING, RunStatus.WAITING_APPROVAL].includes(run.status)
      ) {
        return { ...run, stepCount: (memorySteps.get(run.id) || []).length };
      }
    }
    return null;
  }

  const result = await persistenceQuery(
    `SELECT TOP 1 r.*,
            (SELECT COUNT(*) FROM agent_run_steps s WHERE s.run_id = r.id) AS step_count
     FROM agent_runs r
     WHERE r.conversation_id = @conversationId
       AND r.status IN ('running', 'waiting_approval')
     ORDER BY r.updated_at DESC`,
    { conversationId }
  );
  const row = result.recordset[0];
  if (!row) return null;
  return rowToRun(row, row.step_count ?? 0);
}

export async function getRun(runId) {
  if (useMemory()) {
    const run = memoryRuns.get(runId);
    if (!run) return null;
    return { ...run, stepCount: (memorySteps.get(runId) || []).length };
  }

  const result = await persistenceQuery(
    `SELECT r.*,
            (SELECT COUNT(*) FROM agent_run_steps s WHERE s.run_id = r.id) AS step_count
     FROM agent_runs r WHERE r.id = @runId`,
    { runId }
  );
  const row = result.recordset[0];
  return row ? rowToRun(row, row.step_count ?? 0) : null;
}

export async function listRuns({ status, projectId, conversationId, limit = 50, offset = 0 } = {}) {
  if (useMemory()) {
    let runs = [...memoryRuns.values()];
    if (status) runs = runs.filter((r) => r.status === status);
    if (projectId) runs = runs.filter((r) => r.projectId === projectId);
    if (conversationId) runs = runs.filter((r) => r.conversationId === conversationId);
    runs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return runs.slice(offset, offset + limit).map((r) => ({
      ...r,
      stepCount: (memorySteps.get(r.id) || []).length,
    }));
  }

  const inputs = { limit, offset };
  const filters = [];
  if (status) {
    filters.push("r.status = @status");
    inputs.status = status;
  }
  if (projectId) {
    filters.push("r.project_id = @projectId");
    inputs.projectId = projectId;
  }
  if (conversationId) {
    filters.push("r.conversation_id = @conversationId");
    inputs.conversationId = conversationId;
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const result = await persistenceQuery(
    `SELECT r.*,
            (SELECT COUNT(*) FROM agent_run_steps s WHERE s.run_id = r.id) AS step_count
     FROM agent_runs r
     ${where}
     ORDER BY r.updated_at DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    inputs
  );
  return result.recordset.map((row) => rowToRun(row, row.step_count ?? 0));
}

export async function updateRunStatus(runId, status, { error = null } = {}) {
  const finishedAt =
    status === RunStatus.COMPLETED ||
    status === RunStatus.FAILED ||
    status === RunStatus.CANCELLED
      ? new Date().toISOString()
      : null;

  if (useMemory()) {
    const run = memoryRuns.get(runId);
    if (!run) return null;
    run.status = status;
    run.updatedAt = new Date().toISOString();
    if (error) run.error = error;
    if (finishedAt) run.finishedAt = finishedAt;
    const updated = { ...run, stepCount: (memorySteps.get(runId) || []).length };
    emitRunEvent(runId, { type: "status", status, error });
    return updated;
  }

  await persistenceQuery(
    `UPDATE agent_runs
     SET status = @status,
         error_json = @errorJson,
         finished_at = CASE WHEN @finishedAt IS NOT NULL THEN SYSUTCDATETIME() ELSE finished_at END,
         updated_at = SYSUTCDATETIME()
     WHERE id = @runId`,
    {
      runId,
      status,
      errorJson: stringifyJson(error),
      finishedAt: finishedAt ? 1 : null,
    }
  );
  const updated = await getRun(runId);
  emitRunEvent(runId, { type: "status", status, error });
  return updated;
}

export async function appendRunStep(runId, {
  type,
  toolName = null,
  input = null,
  output = null,
  status = "ok",
  durationMs = null,
  usage = null,
  metadata = null,
}) {
  const stepIndex = await nextStepIndex(runId);
  const id = randomUUID();
  const step = {
    id,
    runId,
    stepIndex,
    type,
    toolName,
    status,
    input: maskJson(input),
    output: maskJson(output),
    durationMs,
    retryCount: 0,
    usage,
    metadata,
    createdAt: new Date().toISOString(),
  };

  if (useMemory()) {
    const steps = memorySteps.get(runId) || [];
    steps.push(step);
    memorySteps.set(runId, steps);
    const run = memoryRuns.get(runId);
    if (run) {
      run.currentStep = stepIndex + 1;
      run.updatedAt = new Date().toISOString();
    }
    emitRunEvent(runId, { type: "step", step });
    return step;
  }

  await persistenceQuery(
    `INSERT INTO agent_run_steps (id, run_id, step_index, step_type, tool_name, status, input_json, output_json, duration_ms, usage_json, metadata_json)
     VALUES (@id, @runId, @stepIndex, @type, @toolName, @status, @inputJson, @outputJson, @durationMs, @usageJson, @metadataJson);
     UPDATE agent_runs SET current_step = @stepIndex + 1, updated_at = SYSUTCDATETIME() WHERE id = @runId`,
    {
      id,
      runId,
      stepIndex,
      type,
      toolName,
      status,
      inputJson: stringifyJson(maskJson(input)),
      outputJson: stringifyJson(maskJson(output)),
      durationMs,
      usageJson: stringifyJson(usage),
      metadataJson: stringifyJson(metadata),
    }
  );
  emitRunEvent(runId, { type: "step", step });
  return step;
}

export async function listRunSteps(runId, { limit = 100, offset = 0 } = {}) {
  if (useMemory()) {
    const steps = memorySteps.get(runId) || [];
    return steps.slice(offset, offset + limit);
  }

  const result = await persistenceQuery(
    `SELECT * FROM agent_run_steps
     WHERE run_id = @runId
     ORDER BY step_index ASC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    { runId, limit, offset }
  );
  return result.recordset.map(rowToStep);
}

export async function createCheckpoint(runId, { stepId = null, approvalId = null, type, payload = null }) {
  const id = randomUUID();
  const checkpoint = {
    id,
    runId,
    stepId,
    approvalId,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };

  if (useMemory()) {
    const list = memoryCheckpoints.get(runId) || [];
    list.push(checkpoint);
    memoryCheckpoints.set(runId, list);
    return checkpoint;
  }

  await persistenceQuery(
    `INSERT INTO agent_run_checkpoints (id, run_id, step_id, approval_id, checkpoint_type, payload_json)
     VALUES (@id, @runId, @stepId, @approvalId, @type, @payloadJson)`,
    {
      id,
      runId,
      stepId,
      approvalId,
      type,
      payloadJson: stringifyJson(payload),
    }
  );
  return checkpoint;
}

/** Test isolation */
export function resetAgentRunsForTests() {
  memoryRuns.clear();
  memorySteps.clear();
  memoryCheckpoints.clear();
}
