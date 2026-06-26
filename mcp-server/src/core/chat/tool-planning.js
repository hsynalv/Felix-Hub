/**
 * Tool planning protocol — guides LLM before tool calls.
 */

import { toolMatchesIntent } from "./tool-intent.js";
import { checkHttpRequestDedicatedRouting } from "./http-dedicated-routing.js";
import { isRiskyIntentMismatch } from "./intent-decision.js";

const PLANNING_PROTOCOL = `## Tool planning protocol
Before calling any tool:
1. Decide whether a tool is **necessary** — prefer answering from injected context when sufficient.
2. **Read before write** — gather state with read-only tools first.
3. Use the **smallest sufficient** tool set (1–2 tools when possible).
4. For write/destructive tools, fill **explanation** with expected effect.
5. **Stop** after tool results are sufficient — do not loop the same tool.

If no tool is needed, answer directly.`;

const INTENT_MICRO_PLANS = {
  read_repo: [
    "1. `git_status` or `repo_summary` for current state",
    "2. `git_diff` / `workspace_read_file` only if needed",
  ],
  modify_files: [
    "1. `workspace_search` or `workspace_read_file` to read current state",
    "2. Write tool with clear `explanation`",
  ],
  brain_recall: [
    "1. Check injected Brain/Project context first",
    "2. Call `brain_recall` once only if insufficient",
  ],
  brain_save: [
    "1. `brain_remember` once with durable content only",
    "2. Confirm briefly to user",
  ],
  project_context: [
    "1. Use injected Brain/Project context + brain_recall for project amounts/facts",
    "2. For live FX rates use tavily__tavily_search — never n8n_* or http_request",
    "3. Do not call n8n tools unless building workflows",
  ],
  run_command: [
    "1. Prefer read-only inspection first",
    "2. `shell_execute` or test runner with explanation",
  ],
  automation: ["1. Identify n8n tool (n8n_* only)", "2. Dry-run or read workflow before write"],
  agent_workflow: [
    "1. `agent_workflow_templates` — see builtin + saved templates",
    "2. `agent_workflow_preview` — validate steps before save",
    "3. `agent_workflow_create` — save new template (show designerUrl)",
    "4. `agent_run_from_template` — execute with parameters",
  ],
  external_api: [
    "1. **Never** use `http_request` for vendors with dedicated tools (github_*, notion_*, tavily__*, n8n_*, slack_*, figma__*)",
    "2. Use the matching MCP/plugin tool; http_request is only for generic allowlisted APIs",
    "3. Do not invent REST paths (/convert, /currency, etc.) — they will be blocked",
  ],
};

/**
 * @param {{ intent?: string; route?: { skipBrainContext?: boolean } }} ctx
 */
export function buildToolPlanningBlock(ctx = {}) {
  const lines = [PLANNING_PROTOCOL];

  if (ctx.intent === "no_tool") {
    lines.push("\n_Planner: tools likely unnecessary for this message._");
  } else if (ctx.intent && ctx.intent !== "general") {
    lines.push(`\n_Planner: primary intent \`${ctx.intent}\` — stay focused._`);
    const micro = INTENT_MICRO_PLANS[ctx.intent];
    if (micro?.length) {
      lines.push("### Suggested steps");
      lines.push(...micro.map((m) => `- ${m}`));
    }
  }

  if (ctx.route?.skipBrainContext) {
    lines.push("_Planner: brain context skipped — do not call brain tools unless user asks._");
  }

  return lines.join("\n");
}

function isWriteToolName(name, tags = []) {
  return (
    tags.includes("write") ||
    tags.includes("destructive") ||
    name.startsWith("brain_remember") ||
    name.includes("delete") ||
    name.includes("forget") ||
    name.startsWith("workspace_write") ||
    name.startsWith("shell_execute")
  );
}

function isReadToolName(name, tags = []) {
  return (
    tags.includes("read_only") ||
    tags.includes("read") ||
    name.startsWith("brain_recall") ||
    name.startsWith("git_") ||
    name.startsWith("workspace_read") ||
    name.startsWith("workspace_search") ||
    name.startsWith("rag_search")
  );
}

function toolCallSignature(name, args) {
  try {
    return `${name}:${JSON.stringify(args ?? {})}`;
  } catch {
    return `${name}:${String(args)}`;
  }
}

/**
 * Lightweight tool call quality guard (pre-execution).
 */
export function guardToolCall(name, args, context = {}, toolDef = null) {
  const tags = toolDef?.tags || [];
  const isWrite = isWriteToolName(name, tags);

  if (name === "http_request" && args?.url) {
    const routeCheck = checkHttpRequestDedicatedRouting(args.url, context.availableToolNames);
    if (routeCheck.blocked) {
      return {
        blocked: true,
        code: "tool_call_rejected_by_guard",
        reason: routeCheck.reason,
      };
    }
  }

  if (name.startsWith("n8n_") && context.intent !== "automation") {
    return {
      blocked: true,
      code: "tool_call_rejected_by_guard",
      reason:
        "n8n tools are for workflow automation only (n8n workflows, nodes, executions). " +
        "For project facts use brain_recall / project_context_*; for live FX or web data use tavily__tavily_search.",
    };
  }

  if (!context.toolCallSignatures) context.toolCallSignatures = new Set();
  const sig = toolCallSignature(name, args);
  if (context.toolCallSignatures.has(sig)) {
    return {
      blocked: true,
      code: "tool_call_rejected_by_guard",
      reason: `Duplicate tool call blocked: ${name} with same arguments already ran this turn.`,
    };
  }

  if (context.intent && context.intent !== "general" && context.intent !== "no_tool") {
    const matches = toolMatchesIntent(context.intent, name);
    if (!matches) {
      if (isRiskyIntentMismatch(name, context.intent)) {
        return {
          blocked: true,
          code: "tool_call_rejected_by_guard",
          reason: `Tool ${name} does not match intent ${context.intent} (risky family blocked).`,
        };
      }
      if (isWrite || isReadToolName(name, tags)) {
        return {
          blocked: false,
          warn: true,
          code: "tool_intent_mismatch",
          reason: `Tool ${name} may not match detected intent ${context.intent}. Prefer intent-aligned tools.`,
        };
      }
    }
  }

  if (isWrite && !args?.explanation?.trim() && name !== "brain_remember") {
    return {
      blocked: true,
      code: "tool_call_rejected_by_guard",
      reason: "Write tool requires a non-empty explanation field.",
    };
  }

  if (isWrite && !context.readToolsUsed && context.intent !== "brain_save") {
    const repoWrite =
      name.startsWith("workspace_") ||
      name.startsWith("shell_") ||
      name.startsWith("project_generate");
    if (repoWrite) {
      return {
        blocked: true,
        code: "tool_call_rejected_by_guard",
        reason: "Read current state with a read-only tool before write/destructive operations.",
      };
    }
  }

  return { blocked: false };
}

export function recordToolCallSignature(name, args, context) {
  if (!context.toolCallSignatures) context.toolCallSignatures = new Set();
  context.toolCallSignatures.add(toolCallSignature(name, args));
}

export function markReadToolUsed(name, tags, context) {
  if (isReadToolName(name, tags)) {
    context.readToolsUsed = true;
  }
}
