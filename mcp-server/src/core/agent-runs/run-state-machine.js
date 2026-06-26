/**
 * Run status transition guard — central state machine for agent runs.
 */

import { RunStatus } from "./agent-runs.service.js";

/** @type {Record<string, Set<string>>} */
export const RUN_STATUS_TRANSITIONS = {
  [RunStatus.PENDING]: new Set([RunStatus.RUNNING, RunStatus.CANCELLED]),
  [RunStatus.RUNNING]: new Set([
    RunStatus.PAUSED,
    RunStatus.WAITING_APPROVAL,
    RunStatus.COMPLETED,
    RunStatus.FAILED,
    RunStatus.CANCELLED,
  ]),
  [RunStatus.WAITING_APPROVAL]: new Set([
    RunStatus.RUNNING,
    RunStatus.CANCELLED,
    RunStatus.FAILED,
  ]),
  [RunStatus.PAUSED]: new Set([RunStatus.RUNNING, RunStatus.CANCELLED]),
  [RunStatus.COMPLETED]: new Set(),
  [RunStatus.FAILED]: new Set([RunStatus.RUNNING, RunStatus.PAUSED]),
  [RunStatus.CANCELLED]: new Set(),
};

/**
 * @param {string} from
 * @param {string} to
 */
export function assertRunStatusTransition(from, to) {
  if (!from) {
    const err = new Error("Run has no current status");
    err.code = "invalid_transition";
    throw err;
  }
  if (from === to) return;
  const allowed = RUN_STATUS_TRANSITIONS[from];
  if (!allowed?.has(to)) {
    const err = new Error(`Invalid status transition: ${from} → ${to}`);
    err.code = "invalid_transition";
    throw err;
  }
}

export function canTransitionRunStatus(from, to) {
  try {
    assertRunStatusTransition(from, to);
    return true;
  } catch {
    return false;
  }
}
