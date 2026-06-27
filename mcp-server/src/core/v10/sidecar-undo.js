/**
 * V10 Faz C — Sidecar undo record store + after-execution hook.
 */

import { registerAfterExecutionHook } from "../tool-hooks.js";

const MAX_RECORDS = 100;
/** @type {Array<object>} */
const records = [];

const UNDO_TOOLS = new Set([
  "fs_write",
  "fs_copy",
  "fs_move",
  "fs_delete_to_trash",
  "clipboard_write",
]);

/**
 * @param {object} record
 */
export function saveUndoRecord(record) {
  const entry = {
    id: `undo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...record,
  };
  records.unshift(entry);
  while (records.length > MAX_RECORDS) records.pop();
  return entry;
}

/**
 * @param {number} [limit]
 */
export function listUndoRecords(limit = 20) {
  return records.slice(0, limit);
}

/**
 * @param {string} id
 */
export function getUndoRecord(id) {
  return records.find((r) => r.id === id) || null;
}

/** @internal */
export function clearUndoRecordsForTests() {
  records.length = 0;
}

let registered = false;

export function registerSidecarUndoHook() {
  if (registered) return;
  registered = true;

  registerAfterExecutionHook(async (toolName, args, context, result) => {
    if (!result?.ok || !UNDO_TOOLS.has(toolName)) return;
    const undo = result.data?.undo;
    if (!undo) return;

    const record = saveUndoRecord({
      toolName,
      args: {
        path: args.path,
        source: args.source,
        destination: args.destination,
      },
      actor: context.actor || context.user || "agent",
      channel: context.channel || "hub",
      undo,
    });

    if (result.data) {
      result.data.undoRecordId = record.id;
    }
  });
}

/** @internal */
export function resetSidecarUndoHookForTests() {
  registered = false;
  clearUndoRecordsForTests();
}
