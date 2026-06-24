/**
 * Job runner for long-running agent runs (background execution).
 */

import { registerJobRunner, cancelJob } from "../jobs.js";
import { runChatTurn } from "../chat-orchestrator.js";
import { getRun, updateRunStatus, RunStatus } from "./agent-runs.service.js";
import { completeRun, cancelRun as cancelAgentRun } from "./run-orchestrator.js";
import { emitRunEvent } from "./run-events.js";

export const AGENT_RUN_JOB_TYPE = "agent_run";
/** Default max wall-clock for a background agent run (30 min). */
export const AGENT_RUN_TIMEOUT_MS = Number(process.env.AGENT_RUN_TIMEOUT_MS) || 30 * 60 * 1000;

/** @type {Map<string, string>} runId -> jobId */
const runJobLinks = new Map();
/** @type {Map<string, NodeJS.Timeout>} jobId -> timeout handle */
const jobTimeouts = new Map();

export function linkRunToJob(runId, jobId) {
  if (runId && jobId) runJobLinks.set(runId, jobId);
}

export function getJobIdForRun(runId) {
  return runJobLinks.get(runId) || null;
}

function clearJobTimeout(jobId) {
  const t = jobTimeouts.get(jobId);
  if (t) {
    clearTimeout(t);
    jobTimeouts.delete(jobId);
  }
}

export function registerAgentRunJobRunner() {
  registerJobRunner(AGENT_RUN_JOB_TYPE, async (job, updateProgress, log) => {
    const { runId, message, history = [], model, systemPrompt, allowWriteTools = true, context = {} } =
      job.payload || {};

    if (!runId || !message) {
      throw new Error("agent_run job requires runId and message in payload");
    }

    const run = await getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);

    linkRunToJob(runId, job.id);
    await updateRunStatus(runId, RunStatus.RUNNING);
    emitRunEvent(runId, { type: "status", status: RunStatus.RUNNING, jobId: job.id });
    await log(`Agent run ${runId} started`);

    const timeout = setTimeout(async () => {
      await log(`Run timeout after ${AGENT_RUN_TIMEOUT_MS}ms`);
      await cancelAgentRun(runId, "run_timeout");
      emitRunEvent(runId, { type: "status", status: RunStatus.CANCELLED, reason: "timeout" });
      await cancelJob(job.id);
    }, AGENT_RUN_TIMEOUT_MS);
    jobTimeouts.set(job.id, timeout);

    try {
      await updateProgress(5);
      const result = await runChatTurn({
        message,
        history,
        model,
        systemPrompt,
        allowWriteTools,
        projectId: context.projectId || run.projectId,
        context: {
          ...context,
          runId,
          conversationId: run.conversationId,
          source: "agent_run_job",
        },
        onToolCall: (payload) => {
          emitRunEvent(runId, { type: "tool", ...payload });
        },
      });

      await updateProgress(95);
      await completeRun(runId, { usage: result.usage });
      emitRunEvent(runId, {
        type: "status",
        status: RunStatus.COMPLETED,
        usage: result.usage,
      });
      await log("Run completed");
      await updateProgress(100);
      return { text: result.text, usage: result.usage };
    } catch (err) {
      await completeRun(runId, { error: { message: err.message } });
      emitRunEvent(runId, { type: "status", status: RunStatus.FAILED, error: err.message });
      throw err;
    } finally {
      clearJobTimeout(job.id);
      runJobLinks.delete(runId);
    }
  });
}

export async function cancelRunJob(runId, reason = "user_cancelled") {
  const jobId = getJobIdForRun(runId);
  if (jobId) {
    clearJobTimeout(jobId);
    await cancelJob(jobId);
    runJobLinks.delete(runId);
  }
  return cancelAgentRun(runId, reason);
}

/** Test isolation */
export function resetAgentRunJobsForTests() {
  for (const t of jobTimeouts.values()) clearTimeout(t);
  jobTimeouts.clear();
  runJobLinks.clear();
}
