import { describe, it, expect } from "vitest";
import {
  resolveChatProfile,
  applyProfileToToolIntent,
  CHAT_PROFILES,
} from "../../src/core/chat/chat-profiles.js";
import { selectChatTools } from "../../src/core/chat-orchestrator.js";
import { ToolTags } from "../../src/core/tool-registry.js";

describe("chat-profiles", () => {
  it("resolves unknown profile to balanced", () => {
    expect(resolveChatProfile("unknown").id).toBe("balanced");
  });

  it("safe profile forces no_tool when detected intent is write", () => {
    const intent = applyProfileToToolIntent("modify_files", "safe");
    expect(intent).toBe("no_tool");
  });

  it("project_work keeps project_context intent", () => {
    const intent = applyProfileToToolIntent("project_context", "project_work");
    expect(intent).toBe("project_context");
  });

  it("safe profile filters write tools", () => {
    const tools = [
      { name: "brain_recall", tags: [ToolTags.READ_ONLY] },
      { name: "workspace_write_file", tags: [ToolTags.WRITE] },
    ];
    const selected = selectChatTools(tools, {
      allowWriteTools: true,
      chatProfile: "safe",
      toolIntent: "brain_recall",
    });
    expect(selected.map((t) => t.name)).toEqual(["brain_recall"]);
  });

  it("no_tool intent returns no tools even with plugin filter", () => {
    const tools = [
      { name: "git_status", plugin: "git", tags: [ToolTags.READ_ONLY] },
      { name: "other_tool", plugin: "git", tags: [ToolTags.READ_ONLY] },
    ];
    expect(
      selectChatTools(tools, {
        pluginFilter: "git",
        toolIntent: "no_tool",
        chatProfile: "balanced",
      })
    ).toEqual([]);
  });

  it("exports all planned profile ids", () => {
    expect(Object.keys(CHAT_PROFILES)).toContain("high_autonomy");
    expect(Object.keys(CHAT_PROFILES)).toContain("personal_assistant");
    expect(Object.keys(CHAT_PROFILES)).toContain("telegram_assistant");
  });

  it("telegram_assistant allows external_api and write", () => {
    const profile = resolveChatProfile("telegram_assistant");
    expect(profile.allowWriteTools).toBe(true);
    expect(profile.toolIntents).toContain("external_api");
    expect(applyProfileToToolIntent("external_api", "telegram_assistant")).toBe("external_api");
  });
});
