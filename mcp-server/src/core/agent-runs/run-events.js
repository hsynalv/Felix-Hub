/**
 * In-process pub/sub for agent run step and status updates (SSE consumers).
 */

import { EventEmitter } from "events";

const bus = new EventEmitter();
bus.setMaxListeners(100);

/**
 * @param {string} runId
 * @param {(event: object) => void} listener
 * @returns {() => void}
 */
export function subscribeRunEvents(runId, listener) {
  const channel = `run:${runId}`;
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}

/**
 * @param {string} runId
 * @param {object} event
 */
export function emitRunEvent(runId, event) {
  if (!runId) return;
  bus.emit(`run:${runId}`, { runId, ts: new Date().toISOString(), ...event });
}

/** Test isolation */
export function resetRunEventsForTests() {
  bus.removeAllListeners();
}
