import { describe, it, expect } from "vitest";
import {
  classifyToolIntentRegex,
  shortlistToolsForIntent,
  toolMatchesIntent,
  buildToolIntentHint,
} from "../../src/core/chat/tool-intent.js";

describe("tool-intent", () => {
  it("classifies brain save intent", () => {
    expect(classifyToolIntentRegex("bunu kaydet").intent).toBe("brain_save");
  });

  it("classifies repo read intent", () => {
    expect(classifyToolIntentRegex("git status ne?").intent).toBe("read_repo");
  });

  it("classifies no_tool for short greetings", () => {
    expect(classifyToolIntentRegex("merhaba").intent).toBe("no_tool");
  });

  it("matches tools to intent", () => {
    expect(toolMatchesIntent("read_repo", "git_status")).toBe(true);
    expect(toolMatchesIntent("brain_save", "brain_remember")).toBe(true);
  });

  it("shortlists matching tools first", () => {
    const tools = [
      { name: "zulu_misc" },
      { name: "git_status" },
      { name: "alpha_other" },
    ];
    const sorted = shortlistToolsForIntent(tools, "read_repo");
    expect(sorted[0].name).toBe("git_status");
  });

  it("returns empty shortlist for no_tool", () => {
    const tools = [{ name: "git_status" }, { name: "brain_recall" }];
    expect(shortlistToolsForIntent(tools, "no_tool")).toEqual([]);
  });

  it("classifies gigi project TL question as project_context", () => {
    const r = classifyToolIntentRegex("gigi projesinde alacağımız tutarın tl karşılığı ne kanka");
    expect(r.intent).toBe("project_context");
    expect(r.needsLiveRate).toBe(true);
    expect(r.reasons).toContain("currency_lookup");
  });

  it("buildToolIntentHint warns against n8n for project context", () => {
    const hint = buildToolIntentHint(
      classifyToolIntentRegex("gigi projesinde alacağımız tutarın tl karşılığı ne")
    );
    expect(hint).toContain("project_context");
    expect(hint).toContain("n8n");
    expect(hint).toContain("tavily");
  });

  it("classifies hub workflow intent separately from n8n", () => {
    expect(classifyToolIntentRegex("workflow oluştur repo analiz et").intent).toBe("agent_workflow");
    expect(classifyToolIntentRegex("n8n workflow ekle").intent).toBe("automation");
    expect(toolMatchesIntent("agent_workflow", "agent_workflow_create")).toBe(true);
    expect(toolMatchesIntent("automation", "n8n_list_workflows")).toBe(true);
  });
});
