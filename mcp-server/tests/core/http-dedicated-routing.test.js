import { describe, it, expect } from "vitest";
import { checkHttpRequestDedicatedRouting } from "../../src/core/chat/http-dedicated-routing.js";

const WITH_GITHUB = ["github_list_repos", "github_get_file"];
const WITH_TAVILY = ["tavily__tavily_search"];
const WITH_NOTION = ["notion_search"];

describe("http-dedicated-routing", () => {
  it("blocks Tavily convert URL when Tavily tools registered", () => {
    const r = checkHttpRequestDedicatedRouting(
      "https://api.tavily.com/v1/convert?from=USD&to=TRY&amount=4700",
      WITH_TAVILY
    );
    expect(r.blocked).toBe(true);
    expect(r.reason).toContain("tavily__tavily_search");
  });

  it("blocks hallucinated convert path even without vendor tools", () => {
    const r = checkHttpRequestDedicatedRouting(
      "https://example.com/v1/convert?x=1",
      []
    );
    expect(r.blocked).toBe(true);
    expect(r.ruleId).toBe("hallucinated_path");
  });

  it("blocks GitHub API when github_ tools exist", () => {
    const r = checkHttpRequestDedicatedRouting(
      "https://api.github.com/repos/org/repo/issues",
      WITH_GITHUB
    );
    expect(r.blocked).toBe(true);
    expect(r.reason).toContain("github_list_repos");
  });

  it("blocks Notion API when notion_ tools exist", () => {
    const r = checkHttpRequestDedicatedRouting(
      "https://api.notion.com/v1/search",
      WITH_NOTION
    );
    expect(r.blocked).toBe(true);
    expect(r.reason).toContain("notion_search");
  });

  it("allows generic API when no dedicated tools match", () => {
    const r = checkHttpRequestDedicatedRouting(
      "https://api.example.com/v1/data",
      WITH_GITHUB
    );
    expect(r.blocked).toBe(false);
  });

  it("allows GitHub URL when github tools not registered", () => {
    const r = checkHttpRequestDedicatedRouting(
      "https://api.github.com/repos/org/repo/issues",
      []
    );
    expect(r.blocked).toBe(false);
  });

  it("blocks n8n workflow API path when n8n tools exist", () => {
    const r = checkHttpRequestDedicatedRouting(
      "http://localhost:5678/api/v1/workflows",
      ["n8n_list_workflows"]
    );
    expect(r.blocked).toBe(true);
    expect(r.reason).toContain("n8n_list_workflows");
  });
});
