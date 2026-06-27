/**
 * Tool planning protocol — guides LLM before tool calls.
 * V8 Faz B: decision tree, mode/profile awareness, eval schema.
 */

import { toolMatchesIntent } from "./tool-intent.js";
import { checkHttpRequestDedicatedRouting } from "./http-dedicated-routing.js";
import { isRiskyIntentMismatch } from "./intent-decision.js";
import { isChatMode } from "./prompt-constants.js";
import { resolveChatProfile } from "./chat-profiles.js";

const TOOL_DECISION_TREE = `## Tool decision tree (follow in order)
1. **Need tool?** — If injected context fully answers the question, respond without tools.
2. **Intent** — Match detected intent; do not scatter across unrelated plugins.
3. **Read first** — Run read-only tools before any write/destructive action.
4. **Risk** — Check tags: write, destructive, needs_approval.
5. **Approval** — If policy requires approval, wait; never bypass or pretend success.
6. **Stop** — When results are sufficient, synthesize and stop; no duplicate calls.

### Loop prevention
- Do not call the same tool with identical arguments twice in one turn.
- After **reflect**, do not start another tool round without new user input.
- If a tool was blocked by the server guard, read the reason and try an aligned alternative once.`;

const PLANNING_PROTOCOL = `${TOOL_DECISION_TREE}

## Tool planning protocol
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

/** @type {Record<string, string>} */
const MODE_PLANNING_HINTS = {
  chat: "_Mode: chat — minimize tools; answer from context when possible._",
  agent: "_Mode: agent — use tools when live data or hub actions are required._",
  spec: "_Mode: spec — **no write tools**; produce planning artifacts in the reply._",
  review: "_Mode: review — **read-only**; never modify files or run shell writes._",
  debug: "_Mode: debug — read/inspect first, then minimal fix tools._",
  ops: "_Mode: ops — prefer **agent_workflow_*** / **agent_run_*** for runbooks._",
  desktop: "_Mode: desktop — local actions via Felix Desktop; expect approvals._",
};

/** JSON schema for eval / structured logging */
export const TOOL_DECISION_SCHEMA = {
  type: "object",
  properties: {
    needsTool: { type: "boolean" },
    intent: { type: "string" },
    readBeforeWriteOk: { type: "boolean" },
    riskLevel: { type: "string", enum: ["low", "medium", "high"] },
    needsApproval: { type: "boolean" },
    shouldStop: { type: "boolean" },
    blocked: { type: "boolean" },
    blockCode: { type: "string" },
    blockReason: { type: "string" },
  },
};

function riskLevelFromTool(name, tags = []) {
  if (tags.includes("destructive") || name.includes("delete") || name.startsWith("shell_execute")) {
    return "high";
  }
  if (tags.includes("write") || name.startsWith("brain_remember") || name.startsWith("workspace_write")) {
    return "medium";
  }
  return "low";
}

function isReadOnlyMode(mode) {
  return mode === "review" || mode === "spec";
}

/**
 * Structured tool decision snapshot (mirrors guard for eval).
 * @param {object} params
 */
export function evaluateToolDecision({
  intent = "general",
  mode = "agent",
  toolName = "",
  tags = [],
  readToolsUsed = false,
  availableToolNames = [],
  args = {},
}) {
  const decision = {
    needsTool: intent !== "no_tool" && !!toolName,
    intent,
    readBeforeWriteOk: true,
    riskLevel: toolName ? riskLevelFromTool(toolName, tags) : "low",
    needsApproval: false,
    shouldStop: intent === "no_tool",
    blocked: false,
    blockCode: null,
    blockReason: null,
  };

  if (!toolName) return decision;

  const guard = guardToolCall(toolName, args, {
    intent,
    readToolsUsed,
    availableToolNames,
    chatMode: mode,
    toolCallSignatures: new Set(),
  }, { tags });

  decision.blocked = guard.blocked;
  decision.blockCode = guard.code || null;
  decision.blockReason = guard.reason || null;
  decision.readBeforeWriteOk = !guard.blocked || guard.code !== "tool_call_rejected_by_guard" || !String(guard.reason || "").includes("Read current state");

  if (isReadOnlyMode(mode) && isWriteToolName(toolName, tags)) {
    decision.blocked = true;
    decision.blockCode = "mode_read_only";
    decision.blockReason = `Write tool ${toolName} blocked in ${mode} mode.`;
  }

  return decision;
}

/**
 * @param {{ intent?: string; route?: { skipBrainContext?: boolean }; chatMode?: string; chatProfile?: string }} ctx
 */
export function buildToolPlanningBlock(ctx = {}) {
  const lines = [PLANNING_PROTOCOL];
  const mode = isChatMode(ctx.chatMode) ? ctx.chatMode : resolveChatProfile(ctx.chatProfile).mode;
  const modeHint = MODE_PLANNING_HINTS[mode];
  if (modeHint) lines.push(modeHint);

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

  if (mode === "ops" && ctx.intent !== "agent_workflow" && ctx.intent !== "automation") {
    lines.push("_Ops hint: consider **agent_workflow_*** tools for multi-step runbooks._");
  }

  if (ctx.route?.skipBrainContext) {
    lines.push("_Planner: brain context skipped — do not call brain tools unless user asks._");
  }

  return lines.join("\n");
}

export function isWriteToolName(name, tags = []) {
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
  const mode = isChatMode(context.chatMode) ? context.chatMode : null;

  if (mode === "review" && isWrite) {
    return {
      blocked: true,
      code: "mode_read_only",
      reason: `Review mode blocks write tool: ${name}.`,
    };
  }

  if (mode === "spec" && isWrite && !name.startsWith("brain_recall")) {
    return {
      blocked: true,
      code: "mode_spec_no_write",
      reason: `Spec mode blocks mutating tools (${name}). Produce artifacts in the reply instead.`,
    };
  }

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
