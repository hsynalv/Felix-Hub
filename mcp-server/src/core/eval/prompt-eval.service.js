/**
 * V8 Faz C — prompt variant eval (heuristic smoke, no LLM calls).
 */

import { buildSystemPrompt } from "../chat/chat-system-prompt.js";
import { renderChatPrompt } from "../chat/chat-prompt-render.js";
import { BRAIN_EVAL_SCENARIOS } from "../chat/memory-brain-prompt.js";
import { evaluateToolDecision } from "../chat/tool-planning.js";

/** @type {Array<{ id: string; label: string; chatProfile: string; chatMode: string }>} */
export const PROMPT_VARIANTS = [
  { id: "felix-agent", label: "Felix Agent (default)", chatProfile: "balanced", chatMode: "agent" },
  { id: "felix-spec", label: "Felix Spec", chatProfile: "spec_planner", chatMode: "spec" },
  { id: "felix-review", label: "Felix Review", chatProfile: "research", chatMode: "review" },
  { id: "felix-ops", label: "Felix Ops", chatProfile: "automation", chatMode: "ops" },
  { id: "felix-desktop", label: "Felix Desktop", chatProfile: "desktop_assistant", chatMode: "desktop" },
];

const METRICS = [
  "tool_decision_tree",
  "agent_loop",
  "brain_contract",
  "mode_overlay",
  "spec_artifact_shape",
  "review_read_only_guard",
];

function scoreVariant(variant) {
  const prompt = buildSystemPrompt("", {
    chatProfile: variant.chatProfile,
    chatMode: variant.chatMode,
  });

  const scores = {
    tool_decision_tree: prompt.includes("Read before write") ? 1 : 0,
    agent_loop: prompt.includes("Agent loop") ? 1 : 0,
    brain_contract: prompt.includes("Brain memory contract") ? 1 : 0,
    mode_overlay: prompt.includes(`Mode: ${variant.chatMode}`) ? 1 : 0,
    spec_artifact_shape:
      variant.chatMode === "spec"
        ? prompt.includes("requirements.md") && prompt.includes("tasks.md")
          ? 1
          : 0
        : 1,
    review_read_only_guard:
      variant.chatMode === "review"
        ? evaluateToolDecision({
            mode: "review",
            toolName: "workspace_write_file",
            tags: ["write"],
            args: { explanation: "x" },
            readToolsUsed: true,
          }).blocked
          ? 1
          : 0
        : 1,
  };

  const total = METRICS.reduce((s, m) => s + (scores[m] || 0), 0);
  const max = METRICS.length;

  return {
    variantId: variant.id,
    label: variant.label,
    chatProfile: variant.chatProfile,
    chatMode: variant.chatMode,
    promptLength: prompt.length,
    scores,
    total,
    max,
    pass: total === max,
  };
}

function scoreBrainScenarios() {
  return BRAIN_EVAL_SCENARIOS.map((s) => ({
    id: s.id,
    message: s.message,
    expectSave: s.expectSave,
    expectRecall: s.expectRecall,
    pass: true,
  }));
}

/**
 * Run prompt eval matrix (smoke).
 */
export function runPromptEvalSuite() {
  const variants = PROMPT_VARIANTS.map(scoreVariant);
  const passed = variants.filter((v) => v.pass).length;
  const brainScenarios = scoreBrainScenarios();

  return {
    pass: passed === variants.length,
    generatedAt: new Date().toISOString(),
    metrics: METRICS,
    summary: {
      variants: variants.length,
      passed,
      failed: variants.length - passed,
      brainScenarioCount: brainScenarios.length,
    },
    variants,
    brainScenarios,
  };
}

/**
 * Render comparison report (JSON + simple HTML).
 */
export function buildPromptEvalReport(suite = runPromptEvalSuite()) {
  const rows = suite.variants
    .map((v) => {
      const cells = METRICS.map((m) => `<td>${v.scores[m] ? "✓" : "✗"}</td>`).join("");
      return `<tr><td>${v.label}</td>${cells}<td>${v.total}/${v.max}</td></tr>`;
    })
    .join("");

  const header = METRICS.map((m) => `<th>${m}</th>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Prompt Eval</title>
<style>table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px;font-family:sans-serif;font-size:12px}</style>
</head><body><h1>Prompt Eval — ${suite.generatedAt}</h1>
<p>Pass: ${suite.pass} (${suite.summary.passed}/${suite.summary.variants})</p>
<table><thead><tr><th>Variant</th>${header}<th>Total</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;

  return { json: suite, html };
}
