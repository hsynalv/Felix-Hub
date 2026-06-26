/**
 * V7 — Life automation agent service.
 */

import { getLifeAgentPreset, listLifeAgentPresets } from "./life-agent-catalog.js";
import {
  listLifeAgents,
  getLifeAgentById,
  createLifeAgent,
  updateLifeAgent,
  deleteLifeAgent,
  recordLifeAgentRun,
  listLifeAgentHistory,
} from "./life-agent-store.js";
import { createWatcher } from "../v6/watcher-store.js";

export { listLifeAgentPresets };

export function listUserLifeAgents(opts) {
  return listLifeAgents(opts);
}

export function getUserLifeAgent(id) {
  return getLifeAgentById(id);
}

export function createUserLifeAgentFromPreset(presetId, overrides = {}) {
  const preset = getLifeAgentPreset(presetId);
  if (!preset) {
    throw Object.assign(new Error(`Unknown preset: ${presetId}`), { code: "invalid" });
  }
  return createLifeAgent({
    name: overrides.name || preset.name,
    goal: overrides.goal || preset.goal,
    type: preset.type,
    presetId: preset.id,
    sources: preset.sources,
    allowedTools: preset.allowedTools,
    schedule: preset.schedule,
    approvalPolicy: preset.approvalPolicy,
    outputChannels: preset.outputChannels,
    memoryScope: preset.memoryScope,
    costLimitUsd: overrides.costLimitUsd ?? preset.costLimitUsd,
    enabled: overrides.enabled !== false,
  });
}

export function createUserLifeAgent(input) {
  return createLifeAgent(input);
}

export function patchUserLifeAgent(id, patch) {
  return updateLifeAgent(id, patch);
}

export function removeUserLifeAgent(id) {
  return deleteLifeAgent(id);
}

export function getUserLifeAgentHistory(opts) {
  return listLifeAgentHistory(opts);
}

/**
 * Dry-run test — records intent without spawning full workflow.
 */
export async function testLifeAgent(id) {
  const agent = getLifeAgentById(id);
  if (!agent) {
    return { ok: false, error: { code: "not_found", message: "Life agent not found" } };
  }
  const runId = `dry-${id}-${Date.now()}`;
  recordLifeAgentRun(id, {
    runId,
    outcome: "dry_run",
    goal: agent.goal,
    message: `Test run for ${agent.name}`,
  });
  return {
    ok: true,
    data: {
      agentId: id,
      runId,
      dryRun: true,
      goal: agent.goal,
      allowedTools: agent.allowedTools,
      approvalPolicy: agent.approvalPolicy,
    },
  };
}

/**
 * Optional: bind life agent to V6 watcher for scheduled firing.
 */
export function bindLifeAgentWatcher(agentId) {
  const agent = getLifeAgentById(agentId);
  if (!agent) return null;
  if (agent.watcherId) return getLifeAgentById(agentId);

  const watcher = createWatcher({
    name: `Life: ${agent.name}`,
    description: agent.goal,
    source: "life_agent",
    eventTypes: ["schedule", "manual"],
    skillId: "skill-research-brief",
    projectId: null,
    parameters: { lifeAgentId: agent.id, goal: agent.goal },
    dryRun: true,
    enabled: agent.enabled,
  });

  return updateLifeAgent(agentId, { watcherId: watcher.id });
}
