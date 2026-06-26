import { describe, it, expect } from "vitest";
import { applyRuleBasedLabel, parseLlmLabelResponse } from "../../src/core/chat/tool-intent-labeler.js";

describe("tool-intent-labeler", () => {
  it("parses LLM label JSON", () => {
    const r = parseLlmLabelResponse('{"intent":"project_context","confidence":0.92,"reason":"project cue"}');
    expect(r?.intent).toBe("project_context");
    expect(r?.confidence).toBe(0.92);
  });

  it("rule labels tavily-only general as external_api", () => {
    const label = applyRuleBasedLabel({
      predictedIntent: "general",
      toolsUsed: ["tavily__tavily_search"],
      guardBlocks: [],
    });
    expect(label?.intent).toBe("external_api");
  });

  it("rule labels n8n guard then brain as project_context", () => {
    const label = applyRuleBasedLabel({
      predictedIntent: "general",
      toolsUsed: ["brain_recall"],
      guardBlocks: [{ toolName: "n8n_get_context", code: "intent_mismatch" }],
    });
    expect(label?.intent).toBe("project_context");
  });
});
