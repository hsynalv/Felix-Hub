import { describe, it, expect } from "vitest";
import { classifyToolIntentRegex } from "../../src/core/chat/tool-intent.js";
import { guardToolCall } from "../../src/core/chat/tool-planning.js";

describe("intent confusion — read_repo / project_context / brain_recall", () => {
  const triples = [
    { utterance: "git status ne", expected: "read_repo" },
    { utterance: "projede son durum ne", expected: "project_context" },
    { utterance: "ne biliyorsun bunun hakkında", expected: "brain_recall" },
    { utterance: "repo summary", expected: "read_repo" },
    { utterance: "workspace context for billing", expected: "project_context" },
    { utterance: "what do you know about this", expected: "brain_recall" },
    { utterance: "git diff göster", expected: "read_repo" },
    { utterance: "projede ödeme planı ne", expected: "project_context" },
    { utterance: "bunu hatırlıyor musun", expected: "brain_recall" },
  ];

  it.each(triples)("classifies \"$utterance\" as $expected", ({ utterance, expected }) => {
    expect(classifyToolIntentRegex(utterance).intent).toBe(expected);
  });

  it("warns on read tool intent mismatch", () => {
    const ctx = { intent: "project_context", guardBlocks: [] };
    const result = guardToolCall("git_status", {}, ctx, { tags: ["read_only"] });
    expect(result.blocked).toBe(false);
    expect(result.warn).toBe(true);
    expect(result.code).toBe("tool_intent_mismatch");
  });

  it("blocks n8n on project_context intent", () => {
    const ctx = { intent: "project_context" };
    const result = guardToolCall("n8n_list_workflows", {}, ctx, { tags: ["read_only"] });
    expect(result.blocked).toBe(true);
  });
});
