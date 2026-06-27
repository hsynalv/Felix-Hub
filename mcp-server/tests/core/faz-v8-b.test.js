import { describe, it, expect } from "vitest";
import {
  buildToolPlanningBlock,
  guardToolCall,
  evaluateToolDecision,
  TOOL_DECISION_SCHEMA,
} from "../../src/core/chat/tool-planning.js";
import {
  AGENT_LOOP_PHASES,
  createAgentLoopState,
  setAgentLoopPhase,
  getAgentLoopSnapshot,
  buildAgentLoopHint,
} from "../../src/core/chat/agent-loop.js";
import {
  buildMemoryPromptSection,
  BRAIN_EVAL_SCENARIOS,
} from "../../src/core/chat/memory-brain-prompt.js";
import { renderChatPrompt } from "../../src/core/chat/chat-prompt-render.js";
import { buildSystemPrompt } from "../../src/core/chat/chat-system-prompt.js";

describe("V8 Faz B — tool intelligence", () => {
  it("exports tool decision schema for eval", () => {
    expect(TOOL_DECISION_SCHEMA.properties.blocked.type).toBe("boolean");
    expect(TOOL_DECISION_SCHEMA.properties.riskLevel.enum).toContain("high");
  });

  it("planning block includes decision tree and mode hints", () => {
    const block = buildToolPlanningBlock({ intent: "agent_workflow", chatMode: "ops" });
    expect(block).toContain("Tool decision tree");
    expect(block).toContain("agent_workflow");
    expect(block).toContain("ops");
  });

  it("blocks write tools in review mode", () => {
    const result = guardToolCall(
      "workspace_write_file",
      { explanation: "edit" },
      { readToolsUsed: true, chatMode: "review" },
      { tags: ["write"] }
    );
    expect(result.blocked).toBe(true);
    expect(result.code).toBe("mode_read_only");
  });

  it("blocks mutating tools in spec mode", () => {
    const result = guardToolCall(
      "workspace_write_file",
      { explanation: "save spec" },
      { readToolsUsed: true, chatMode: "spec" },
      { tags: ["write"] }
    );
    expect(result.blocked).toBe(true);
    expect(result.code).toBe("mode_spec_no_write");
  });

  it("evaluateToolDecision mirrors guard for review writes", () => {
    const decision = evaluateToolDecision({
      mode: "review",
      toolName: "shell_execute",
      tags: ["destructive"],
      args: { explanation: "run" },
      readToolsUsed: true,
    });
    expect(decision.blocked).toBe(true);
    expect(decision.blockCode).toBe("mode_read_only");
  });
});

describe("V8 Faz B — memory prompts", () => {
  it("research profile is recall-only in memory section", () => {
    const section = buildMemoryPromptSection("research");
    expect(section).toContain("Recall only");
    expect(section).toContain("brain_remember");
  });

  it("personal_assistant enables brain save guidance", () => {
    const section = buildMemoryPromptSection("personal_assistant");
    expect(section).toContain("brain_save");
  });

  it("includes brain eval scenarios fixture", () => {
    expect(BRAIN_EVAL_SCENARIOS.length).toBeGreaterThanOrEqual(3);
  });

  it("system prompt includes agent loop and memory contract", () => {
    const prompt = buildSystemPrompt("", { chatProfile: "research" });
    expect(prompt).toContain("Agent loop");
    expect(prompt).toContain("Brain memory contract");
    expect(prompt).toContain("Recall only");
  });
});

describe("V8 Faz B — agent loop", () => {
  it("defines six loop phases", () => {
    expect(AGENT_LOOP_PHASES).toEqual(["observe", "plan", "act", "wait", "reflect", "stop"]);
  });

  it("tracks phase history on context", () => {
    const ctx = { agentLoop: createAgentLoopState() };
    setAgentLoopPhase(ctx, "plan");
    setAgentLoopPhase(ctx, "act");
    setAgentLoopPhase(ctx, "reflect");
    const snap = getAgentLoopSnapshot(ctx);
    expect(snap.phase).toBe("reflect");
    expect(snap.history).toContain("plan");
  });

  it("renderChatPrompt embeds agent loop in flow", () => {
    const text = renderChatPrompt({ mode: "agent" });
    expect(text).toContain("observe");
    expect(buildAgentLoopHint("plan")).toContain("plan");
  });
});
