/**
 * Tool Registry Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerTool,
  unregisterTool,
  getTool,
  listTools,
  clearTools,
  callTool,
  ToolTags,
  getToolRegistryStats,
  assertUniqueToolNames,
} from "../../src/core/tool-registry.js";
import { TEST_INPUT_SCHEMA } from "../framework/test-tool-schema.js";

// Mock policy engine
vi.mock("../../src/plugins/policy/policy.engine.js", () => ({
  evaluate: vi.fn(() => ({ allowed: true })),
}));

describe("Tool Registry", () => {
  beforeEach(() => {
    clearTools();
  });

  describe("registerTool", () => {
    it("should register a tool", () => {
      registerTool({
        name: "test_tool",
        description: "A test tool",
        inputSchema: TEST_INPUT_SCHEMA,
        handler: async () => "result",
      });

      const tool = getTool("test_tool");
      expect(tool).toBeDefined();
      expect(tool.name).toBe("test_tool");
      expect(tool.description).toBe("A test tool");
    });

    it("should throw if tool has no name", () => {
      expect(() =>
        registerTool({
          description: "A test tool",
          inputSchema: TEST_INPUT_SCHEMA,
          handler: async () => "result",
        })
      ).toThrow("Tool must have a 'name'");
    });

    it("should throw if tool has no handler", () => {
      expect(() =>
        registerTool({
          name: "test_tool",
          description: "A test tool",
          inputSchema: TEST_INPUT_SCHEMA,
        })
      ).toThrow("must have a handler function");
    });

    it("should map legacy parameters to inputSchema", () => {
      registerTool({
        name: "legacy_tool",
        description: "Legacy parameters tool",
        parameters: TEST_INPUT_SCHEMA,
        handler: async () => "result",
      });

      const tool = getTool("legacy_tool");
      expect(tool.inputSchema).toEqual(TEST_INPUT_SCHEMA);
      expect(tool.parameters).toBeUndefined();
    });
  });

  describe("listTools", () => {
    it("should return empty array when no tools", () => {
      expect(listTools()).toEqual([]);
    });

    it("should return all registered tools", () => {
      registerTool({
        name: "tool1",
        description: "First tool",
        inputSchema: TEST_INPUT_SCHEMA,
        handler: async () => "result1",
      });
      registerTool({
        name: "tool2",
        description: "Second tool",
        inputSchema: TEST_INPUT_SCHEMA,
        handler: async () => "result2",
      });

      const tools = listTools();
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toContain("tool1");
      expect(tools.map((t) => t.name)).toContain("tool2");
    });
  });

  describe("getTool", () => {
    it("should return undefined for non-existent tool", () => {
      expect(getTool("nonexistent")).toBeUndefined();
    });

    it("should return the tool", () => {
      registerTool({
        name: "my_tool",
        description: "My tool",
        inputSchema: TEST_INPUT_SCHEMA,
        handler: async () => "result",
      });

      const tool = getTool("my_tool");
      expect(tool).toBeDefined();
      expect(tool.name).toBe("my_tool");
    });
  });

  describe("callTool", () => {
    it("should return error for non-existent tool", async () => {
      const result = await callTool("nonexistent", {});
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("tool_not_found");
    });

    it("should call the tool handler", async () => {
      registerTool({
        name: "greet",
        description: "Greet someone",
        inputSchema: TEST_INPUT_SCHEMA,
        handler: async (args) => ({ message: `Hello ${args.name}` }),
      });

      const result = await callTool("greet", { name: "World" });
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ message: "Hello World" });
    });

    it("should wrap successful result in envelope", async () => {
      registerTool({
        name: "simple",
        description: "Simple tool",
        inputSchema: TEST_INPUT_SCHEMA,
        handler: async () => "raw result",
      });

      const result = await callTool("simple", {});
      expect(result.ok).toBe(true);
      expect(result.data).toBe("raw result");
    });

    it("should handle tool errors", async () => {
      registerTool({
        name: "failing",
        description: "Failing tool",
        inputSchema: TEST_INPUT_SCHEMA,
        handler: async () => {
          throw new Error("Something went wrong");
        },
      });

      const result = await callTool("failing", {});
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("tool_execution_error");
    });

    it("should reject missing required arguments", async () => {
      registerTool({
        name: "needs_name",
        description: "Requires name",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
        handler: async (args) => ({ echoed: args.name }),
      });

      const result = await callTool("needs_name", {});
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("invalid_args");
    });

    it("should block dangerous arguments via security guard", async () => {
      registerTool({
        name: "file_read",
        description: "Read file",
        inputSchema: TEST_INPUT_SCHEMA,
        handler: async () => ({ ok: true }),
      });

      const result = await callTool("file_read", { path: "../../../etc/passwd" });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("security_blocked");
    });

    it("should require write scope for write-tagged tools when auth enabled", async () => {
      const auth = await import("../../src/core/auth.js");
      vi.spyOn(auth, "isAuthEnabled").mockReturnValue(true);

      registerTool({
        name: "write_tool",
        description: "Write tool",
        inputSchema: TEST_INPUT_SCHEMA,
        tags: [ToolTags.WRITE],
        handler: async () => ({ ok: true }),
      });

      const denied = await callTool("write_tool", {}, { scopes: ["read"] });
      expect(denied.ok).toBe(false);
      expect(denied.error.code).toBe("insufficient_scope");

      const allowed = await callTool("write_tool", {}, { scopes: ["write"] });
      expect(allowed.ok).toBe(true);

      vi.restoreAllMocks();
    });
  });

  describe("getToolRegistryStats", () => {
    it("should aggregate tools by plugin", () => {
      registerTool({
        name: "a1",
        description: "A",
        inputSchema: TEST_INPUT_SCHEMA,
        plugin: "alpha",
        handler: async () => "ok",
      });
      registerTool({
        name: "b1",
        description: "B",
        inputSchema: TEST_INPUT_SCHEMA,
        plugin: "beta",
        handler: async () => "ok",
      });

      const stats = getToolRegistryStats();
      expect(stats.total).toBe(2);
      expect(stats.byPlugin.alpha).toBe(1);
      expect(stats.byPlugin.beta).toBe(1);
    });
  });

  describe("assertUniqueToolNames", () => {
    it("should pass when all names are unique", () => {
      registerTool({
        name: "unique_tool",
        description: "Unique",
        inputSchema: TEST_INPUT_SCHEMA,
        handler: async () => "ok",
      });
      expect(() => assertUniqueToolNames()).not.toThrow();
    });
  });

  describe("registerTool duplicate guard", () => {
    it("should throw when registering the same name twice", () => {
      const def = {
        name: "dup_tool",
        description: "Dup",
        inputSchema: TEST_INPUT_SCHEMA,
        handler: async () => "ok",
      };
      registerTool(def);
      expect(() => registerTool(def)).toThrow(/already registered/);
    });
  });
});
