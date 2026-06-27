import { describe, it, expect, beforeEach } from "vitest";
import {
  saveUndoRecord,
  listUndoRecords,
  registerSidecarUndoHook,
  resetSidecarUndoHookForTests,
  clearUndoRecordsForTests,
} from "../../src/core/v10/sidecar-undo.js";
import { executeAfterHooks } from "../../src/core/tool-hooks.js";

describe("v10 sidecar undo", () => {
  beforeEach(() => {
    resetSidecarUndoHookForTests();
    clearUndoRecordsForTests();
  });

  it("saveUndoRecord stores entry with id", () => {
    const r = saveUndoRecord({
      toolName: "fs_write",
      undo: { type: "fs_write_restore", hadFile: false },
    });
    expect(r.id).toMatch(/^undo_/);
    expect(listUndoRecords()).toHaveLength(1);
  });

  it("after hook captures undo from tool result", async () => {
    registerSidecarUndoHook();
    const result = {
      ok: true,
      data: {
        path: "~/Documents/a.txt",
        undo: { type: "fs_write_restore", content: "old", hadFile: true },
      },
    };
    await executeAfterHooks("fs_write", { path: "~/Documents/a.txt" }, { actor: "test" }, result);
    expect(result.data.undoRecordId).toBeDefined();
    expect(listUndoRecords()[0].toolName).toBe("fs_write");
  });
});
