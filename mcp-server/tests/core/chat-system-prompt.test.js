import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../../src/core/chat/chat-system-prompt.js";
import { BRAND } from "../../src/core/branding.js";

describe("chat-system-prompt identity", () => {
  it("includes Felix identity and Hüseyin Alav attribution", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain(BRAND.assistantName);
    expect(prompt).toContain(BRAND.hubName);
    expect(prompt).toContain(BRAND.authorName);
    expect(prompt).toContain(BRAND.productionUrl);
    expect(prompt).toContain("not** ChatGPT");
  });

  it("includes Felix Hub system overview", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain(BRAND.hubName);
    expect(prompt).toContain("plugin");
    expect(prompt).toContain(BRAND.desktopAgentName);
  });

  it("adds Telegram channel rules when channel is telegram", () => {
    const prompt = buildSystemPrompt("", { channel: "telegram" });
    expect(prompt).toContain("tavily__tavily_search");
    expect(prompt).toContain("notion_list_projects");
    expect(prompt).toContain("bir dakika içinde");
  });
});
