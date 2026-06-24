/**
 * Chat orchestrator unit tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ToolTags } from "../../src/core/tool-registry.js";
import {
  selectChatTools,
  isWriteToolDef,
  isWriteToolName,
  buildOpenAiTools,
  getDefaultModel,
  getOpenAiClient,
  MAX_TOOL_ITERATIONS,
  APPROVAL_TIMEOUT_MS,
} from "../../src/core/chat-orchestrator.js";

describe("chat-orchestrator", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  describe("selectChatTools", () => {
    const readTool = { name: "alpha_read", tags: [ToolTags.READ_ONLY] };
    const writeTool = { name: "zulu_write", tags: [ToolTags.WRITE] };
    const priorityRead = { name: "brain_recall", tags: [ToolTags.READ_ONLY] };

    it("filters write tools when allowWriteTools is false", () => {
      const selected = selectChatTools([readTool, writeTool], { allowWriteTools: false });
      expect(selected.map((t) => t.name)).toEqual(["alpha_read"]);
    });

    it("includes write tools when allowWriteTools is true", () => {
      const selected = selectChatTools([readTool, writeTool], { allowWriteTools: true });
      expect(selected.map((t) => t.name)).toContain("zulu_write");
    });

    it("prioritizes CHAT_TOOL_PRIORITY tools", () => {
      const selected = selectChatTools([readTool, priorityRead, writeTool], { allowWriteTools: true });
      expect(selected[0].name).toBe("brain_recall");
    });

    it("caps tool count at MAX_CHAT_TOOLS (128)", () => {
      const many = Array.from({ length: 200 }, (_, i) => ({
        name: `tool_${i}`,
        tags: [ToolTags.READ_ONLY],
      }));
      expect(selectChatTools(many).length).toBeLessThanOrEqual(128);
    });
  });

  describe("isWriteToolDef", () => {
    it("detects write and destructive tags", () => {
      expect(isWriteToolDef({ tags: [ToolTags.WRITE] })).toBe(true);
      expect(isWriteToolDef({ tags: [ToolTags.DESTRUCTIVE] })).toBe(true);
      expect(isWriteToolDef({ tags: [ToolTags.READ_ONLY] })).toBe(false);
    });
  });

  describe("getDefaultModel", () => {
    it("prefers OpenAI model when OPENAI_API_KEY set", () => {
      process.env.OPENAI_API_KEY = "sk-test";
      process.env.OPENAI_CHAT_MODEL = "gpt-4o";
      expect(getDefaultModel()).toBe("gpt-4o");
    });

    it("falls back to OLLAMA_MODEL without OpenAI", () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.VLLM_BASE_URL;
      process.env.OLLAMA_MODEL = "mistral";
      expect(getDefaultModel()).toBe("mistral");
    });

    it("uses VLLM_MODEL when only VLLM is configured", () => {
      delete process.env.OPENAI_API_KEY;
      process.env.VLLM_BASE_URL = "http://localhost:8000/v1";
      process.env.VLLM_MODEL = "my-local-llm";
      expect(getDefaultModel()).toBe("my-local-llm");
    });
  });

  describe("getOpenAiClient", () => {
    it("returns null without OPENAI_API_KEY", () => {
      delete process.env.OPENAI_API_KEY;
      expect(getOpenAiClient()).toBeNull();
    });

    it("returns client when key present", () => {
      process.env.OPENAI_API_KEY = "sk-test";
      expect(getOpenAiClient()).not.toBeNull();
    });
  });

  describe("constants", () => {
    it("exports iteration and approval limits", () => {
      expect(MAX_TOOL_ITERATIONS).toBe(8);
      expect(APPROVAL_TIMEOUT_MS).toBe(120_000);
    });
  });

  describe("buildOpenAiTools", () => {
    it("returns OpenAI function schema shape", () => {
      const tools = buildOpenAiTools({ allowWriteTools: false });
      expect(Array.isArray(tools)).toBe(true);
      if (tools.length > 0) {
        expect(tools[0]).toHaveProperty("type", "function");
        expect(tools[0].function).toHaveProperty("name");
      }
    });
  });

  describe("isWriteToolName", () => {
    it("returns false for unknown tool names", () => {
      expect(isWriteToolName("__nonexistent_tool_xyz__")).toBe(false);
    });
  });
});
