import { describe, it, expect } from "vitest";
import {
  summarizeToolResult,
  formatToolResultForModel,
} from "../../src/core/chat/tool-result-summarizer.js";

describe("tool-result-summarizer", () => {
  it("summarizes errors compactly", () => {
    const r = summarizeToolResult({
      toolName: "git_status",
      result: { ok: false, error: { code: "repo_missing", message: "Not a git repo", status: 404 } },
    });
    expect(r.ok).toBe(false);
    expect(r.summary).toContain("repo_missing");
    expect(r.summary).toContain("Not a git repo");
  });

  it("summarizes large arrays with count", () => {
    const data = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    const r = summarizeToolResult({ toolName: "list_tools", result: { ok: true, data } });
    expect(r.summary).toContain("50");
    expect(r.truncated).toBe(true);
  });

  it("summarizes brain_recall memories", () => {
    const r = summarizeToolResult({
      toolName: "brain_recall",
      result: {
        ok: true,
        data: {
          query: "preferences",
          memories: [{ type: "preference", content: "Turkish answers" }],
        },
      },
    });
    expect(r.keyFacts.length).toBeGreaterThan(0);
    expect(r.summary).toContain("1 memories");
  });

  it("formatToolResultForModel returns JSON string", () => {
    const s = summarizeToolResult({ toolName: "x", result: { ok: true, data: { a: 1 } } });
    const formatted = formatToolResultForModel(s);
    const parsed = JSON.parse(formatted);
    expect(parsed.summary).toBeTruthy();
  });
});
