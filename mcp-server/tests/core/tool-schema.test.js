import { describe, it, expect } from "vitest";
import { ensureWriteToolExplanation, isWriteOrDestructiveTool } from "../../src/core/tool-schema.js";
import { TEST_INPUT_SCHEMA } from "../framework/test-tool-schema.js";

describe("tool-schema", () => {
  it("detects write/destructive tools by tag", () => {
    expect(isWriteOrDestructiveTool({ tags: ["write"] })).toBe(true);
    expect(isWriteOrDestructiveTool({ tags: ["read_only"] })).toBe(false);
  });

  it("adds explanation property to write tools", () => {
    const tool = ensureWriteToolExplanation({
      name: "demo_write",
      tags: ["write"],
      inputSchema: { type: "object", properties: { path: { type: "string" } } },
    });

    expect(tool.inputSchema.properties.explanation).toBeDefined();
  });

  it("leaves read-only tools unchanged", () => {
    const tool = ensureWriteToolExplanation({
      name: "demo_read",
      tags: ["read_only"],
      inputSchema: TEST_INPUT_SCHEMA,
    });

    expect(tool.inputSchema.properties?.explanation).toBeUndefined();
  });
});
