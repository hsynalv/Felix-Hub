import { describe, it, expect } from "vitest";
import { guardToolCall, buildToolPlanningBlock, recordToolCallSignature } from "../../src/core/chat/tool-planning.js";
import { evaluateMemoryWrite } from "../../src/plugins/brain/brain.write-policy.js";
import { formatMemoryCitation } from "../../src/plugins/brain/brain.memory-scopes.js";

describe("tool-planning", () => {
  it("planning block includes decision tree", () => {
    const block = buildToolPlanningBlock({ intent: "read_repo" });
    expect(block).toContain("Tool decision tree");
    expect(block).toContain("read_repo");
  });

  it("blocks write without explanation", () => {
    const result = guardToolCall(
      "workspace_write_file",
      {},
      { readToolsUsed: false, intent: "modify_files" },
      { tags: ["write"] }
    );
    expect(result.blocked).toBe(true);
    expect(result.code).toBe("tool_call_rejected_by_guard");
  });

  it("allows write after read tool used", () => {
    const result = guardToolCall(
      "workspace_write_file",
      { explanation: "fix typo" },
      { readToolsUsed: true, intent: "modify_files" },
      { tags: ["write"] }
    );
    expect(result.blocked).toBe(false);
  });

  it("includes micro-plan steps for read_repo intent", () => {
    const block = buildToolPlanningBlock({ intent: "read_repo" });
    expect(block).toContain("git_status");
  });

  it("blocks duplicate tool calls with same args", () => {
    const ctx = { toolCallSignatures: new Set() };
    const args = { path: "/foo" };
    const first = guardToolCall("workspace_read_file", args, ctx, { tags: ["read"] });
    expect(first.blocked).toBe(false);
    recordToolCallSignature("workspace_read_file", args, ctx);
    const second = guardToolCall("workspace_read_file", args, ctx, { tags: ["read"] });
    expect(second.blocked).toBe(true);
  });

  it("warns on intent mismatch for write tools", () => {
    const result = guardToolCall(
      "github_list_repos",
      { explanation: "list repos" },
      { readToolsUsed: true, intent: "brain_recall" },
      { tags: ["read_only"] }
    );
    expect(result.blocked).toBe(false);
    expect(result.warn).toBe(true);
  });

  it("blocks fake Tavily REST convert URLs", () => {
    const result = guardToolCall(
      "http_request",
      { url: "https://api.tavily.com/v1/convert?from=USD&to=TRY&amount=4700", explanation: "convert" },
      { readToolsUsed: true, availableToolNames: ["tavily__tavily_search"] },
      { tags: ["write"] }
    );
    expect(result.blocked).toBe(true);
    expect(result.reason).toMatch(/tavily|Tavily|invented/i);
  });

  it("blocks GitHub API when github tools are available", () => {
    const result = guardToolCall(
      "http_request",
      { url: "https://api.github.com/repos/o/r/issues", explanation: "list issues" },
      { readToolsUsed: true, availableToolNames: ["github_list_repos"] },
      { tags: ["write"] }
    );
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("github");
  });

  it("allows Tavily search REST path when no Tavily tools registered", () => {
    const result = guardToolCall(
      "http_request",
      { url: "https://api.tavily.com/search", explanation: "Tavily search API" },
      { readToolsUsed: true, availableToolNames: [], intent: "external_api" },
      { tags: ["write"] }
    );
    expect(result.blocked).toBe(false);
  });

  it("blocks n8n tools when intent is not automation", () => {
    const result = guardToolCall(
      "n8n_get_context",
      { nodes: "slack" },
      { intent: "project_context" },
      { tags: ["read"] }
    );
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("workflow automation");
  });

  it("allows n8n tools for automation intent", () => {
    const result = guardToolCall(
      "n8n_get_context",
      { nodes: "slack", explanation: "workflow" },
      { readToolsUsed: true, intent: "automation" },
      { tags: ["read"] }
    );
    expect(result.blocked).toBe(false);
  });
});

describe("brain.write-policy", () => {
  it("blocks secrets", () => {
    const r = evaluateMemoryWrite("api_key=sk-abcdefghijklmnop");
    expect(r.shouldRemember).toBe(false);
    expect(r.sensitiveRisk).toBe(true);
  });

  it("allows agent-initiated durable saves", () => {
    const r = evaluateMemoryWrite("Gigi projesinde 7600 dolar ödeme", { source: "agent" });
    expect(r.shouldRemember).toBe(true);
  });

  it("requires approval for financial amount with person name", () => {
    const r = evaluateMemoryWrite("Ahmet Yılmaz için 5000 TL ödeme yapıldı");
    expect(r.requiresApproval).toBe(true);
    expect(r.shouldRemember).toBe(true);
  });
});

describe("brain.memory-scopes", () => {
  it("formats citation with scope and id", () => {
    const line = formatMemoryCitation({
      id: "mem_123",
      type: "preference",
      content: "Turkish concise answers",
      confidence: 0.92,
      tags: ["communication"],
      createdAt: new Date().toISOString(),
    });
    expect(line).toContain("[memory:mem_123");
    expect(line).toContain("scope=preferences");
    expect(line).toContain("confidence=0.92");
  });
});
