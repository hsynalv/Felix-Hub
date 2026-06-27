/**
 * Chat system prompt and tool catalog for LLM tool use
 * V8 Faz A: registry-rendered core prompt (felix-default bundle + mode overlays).
 */

import { BRAND } from "../branding.js";
import { getOperatingModelPromptContext } from "../v6-c/operating-model-store.js";
import { resolvePromptRender } from "./chat-profiles.js";
import { renderChatPrompt, buildLegacyBasePrompt } from "./chat-prompt-render.js";

const MAX_CATALOG_CHARS = 4500;

function useLegacyPrompt() {
  return process.env.CHAT_PROMPT_LEGACY === "1" || process.env.CHAT_PROMPT_LEGACY === "true";
}

/**
 * Compact plugin → tools summary for the system prompt
 * @param {Array<{ name: string; description?: string; plugin?: string }>} tools
 */
export function buildToolCatalogSummary(tools) {
  if (!tools?.length) return "";

  const byPlugin = new Map();
  for (const t of tools) {
    const plugin = t.plugin || "core";
    if (!byPlugin.has(plugin)) byPlugin.set(plugin, []);
    byPlugin.get(plugin).push(t);
  }

  const lines = ["## Available plugins & tools (sample)"];
  const sortedPlugins = [...byPlugin.keys()].sort((a, b) => a.localeCompare(b));

  for (const plugin of sortedPlugins) {
    const pluginTools = byPlugin.get(plugin);
    const sample = pluginTools
      .slice(0, 5)
      .map((t) => t.name)
      .join(", ");
    const extra = pluginTools.length > 5 ? ` (+${pluginTools.length - 5} more)` : "";
    lines.push(`- **${plugin}** (${pluginTools.length}): ${sample}${extra}`);
  }

  let text = lines.join("\n");
  if (text.length > MAX_CATALOG_CHARS) {
    text = `${text.slice(0, MAX_CATALOG_CHARS)}…`;
  }
  return text;
}

/**
 * @param {string} [extra]
 * @param {{ toolCatalog?: string; pluginFilter?: string | null; scopedTools?: Array<{ name: string; description?: string }>; channel?: string; chatProfile?: string; chatMode?: string | null; promptBundleId?: string | null; marketplacePackId?: string | null; registryRender?: boolean; projectId?: string | null }} [opts]
 */
export function buildSystemPrompt(extra = "", opts = {}) {
  const {
    toolCatalog = "",
    pluginFilter = null,
    scopedTools = [],
    channel = null,
    projectId = null,
    chatProfile = "balanced",
    chatMode = null,
    promptBundleId = null,
    marketplacePackId = null,
    registryRender = true,
  } = opts;

  const renderOpts = resolvePromptRender({ chatProfile, chatMode, promptBundleId });
  const core =
    registryRender !== false && !useLegacyPrompt()
      ? renderChatPrompt({
          bundleId: renderOpts.promptBundleId,
          mode: renderOpts.mode,
          channel,
          chatProfile: renderOpts.profileId,
          marketplacePackId,
        })
      : buildLegacyBasePrompt();

  const parts = [core];

  if (pluginFilter) {
    const toolLines = scopedTools.length
      ? scopedTools.map((t) => `- ${t.name}: ${(t.description || "").slice(0, 120)}`).join("\n")
      : "";
    parts.push(
      `## Active plugin scope (this message)
The user scoped this turn to plugin **${pluginFilter}** only. Use tools from this plugin unless impossible; then explain why.`,
      toolLines ? `### Tools in scope\n${toolLines}` : ""
    );
  } else if (toolCatalog) {
    parts.push(toolCatalog);
  }

  if (extra?.trim()) parts.push(extra.trim());

  const operatingModel = getOperatingModelPromptContext({ projectId });
  if (operatingModel) parts.push(operatingModel);

  return parts.filter(Boolean).join("\n\n");
}

export { BRAND };
