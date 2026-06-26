import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../../src/core/chat/chat-system-prompt.js";

describe("chat-system-prompt identity", () => {
  it("includes Asistan identity and Hüseyin Alav attribution", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Asistan");
    expect(prompt).toContain("Hüseyin Alav");
    expect(prompt).toContain("asistan.huseyinalav.com");
    expect(prompt).toContain("not** ChatGPT");
  });

  it("includes MCP Hub system overview", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("MCP Hub");
    expect(prompt).toContain("plugin");
  });

  it("adds Telegram channel rules when channel is telegram", () => {
    const prompt = buildSystemPrompt("", { channel: "telegram" });
    expect(prompt).toContain("tavily__tavily_search");
    expect(prompt).toContain("notion_list_projects");
    expect(prompt).toContain("bir dakika içinde");
  });
});
