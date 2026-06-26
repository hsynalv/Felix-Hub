import { describe, it, expect } from "vitest";
import {
  shouldDisableChatTools,
  isRiskyIntentMismatch,
  buildIntentDecisionEnvelope,
} from "../../src/core/chat/intent-decision.js";
import { selectChatTools } from "../../src/core/chat-orchestrator.js";
import { shortlistToolsForIntent } from "../../src/core/chat/tool-intent.js";
import { ToolTags } from "../../src/core/tool-registry.js";

describe("intent-decision", () => {
  it("disables tools for no_tool and answer_only", () => {
    expect(shouldDisableChatTools("no_tool", "balanced")).toBe(true);
    expect(shouldDisableChatTools("read_repo", "answer_only")).toBe(true);
    expect(shouldDisableChatTools("read_repo", "balanced")).toBe(false);
  });

  it("shortlists empty for no_tool", () => {
    const tools = [{ name: "git_status" }, { name: "brain_recall" }];
    expect(shortlistToolsForIntent(tools, "no_tool")).toEqual([]);
  });

  it("selectChatTools returns empty when tools disabled", () => {
    const tools = [
      { name: "git_status", tags: [ToolTags.READ_ONLY] },
      { name: "brain_recall", tags: [ToolTags.READ_ONLY] },
    ];
    expect(selectChatTools(tools, { toolIntent: "no_tool" })).toEqual([]);
    expect(selectChatTools(tools, { chatProfile: "answer_only", toolIntent: "read_repo" })).toEqual([]);
  });

  it("blocks risky families on intent mismatch", () => {
    expect(isRiskyIntentMismatch("n8n_list_workflows", "project_context")).toBe(true);
    expect(isRiskyIntentMismatch("http_get", "brain_recall")).toBe(true);
    expect(isRiskyIntentMismatch("git_status", "project_context")).toBe(false);
  });

  it("builds decision envelope with raw intent", () => {
    const env = buildIntentDecisionEnvelope({
      rawClassification: { intent: "read_repo", rawIntent: "read_repo", confidence: 0.8, source: "regex" },
      effectiveIntent: "no_tool",
      chatProfile: "safe",
      profileOverride: true,
      toolCount: 0,
      guardBlocks: [],
      pluginFilter: null,
    });
    expect(env.rawIntent).toBe("read_repo");
    expect(env.effectiveIntent).toBe("no_tool");
    expect(env.profileOverride).toBe(true);
  });
});
