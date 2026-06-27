/**
 * Unified chat context retriever — router + brain + project + planning hints.
 */

import { analyzeContextNeeds, buildContextRouterHint } from "./context-router.js";
import { classifyToolIntent, buildToolIntentHint } from "./tool-intent.js";
import { buildToolPlanningBlock } from "./tool-planning.js";
import { buildBrainIntentHint } from "./brain-intent.js";
import { buildRoutedBrainContext } from "../../plugins/brain/brain.context.js";
import { buildRoutedProjectContext } from "../project-context/project-context.context.js";
import { applyProfileToToolIntent, resolveChatProfile } from "./chat-profiles.js";
import { buildHistorySummaryBlock } from "./conversation-compression.js";
import { buildAgentLoopHint } from "./agent-loop.js";
import { isChatMode } from "./prompt-constants.js";

/**
 * @param {object} opts
 * @param {string} opts.message
 * @param {string} [opts.projectId]
 * @param {string} [opts.conversationId]
 * @param {boolean} [opts.includeBrainContext]
 * @param {boolean} [opts.hasConversationHistory]
 * @param {string} [opts.chatProfile]
 * @param {string} [opts.chatMode]
 * @param {string} [opts.historySummaryBlock]
 */
export async function getChatContext({
  message,
  projectId = null,
  conversationId = null,
  includeBrainContext = true,
  hasConversationHistory = false,
  chatProfile = "balanced",
  chatMode = null,
  historySummaryBlock = "",
}) {
  const route = analyzeContextNeeds(message, { projectId, hasConversationHistory });
  const rawClassification = await classifyToolIntent(message);
  const profile = resolveChatProfile(chatProfile);
  const effectiveIntent = applyProfileToToolIntent(rawClassification.intent, profile.id);
  const toolClassification = {
    ...rawClassification,
    intent: effectiveIntent,
    rawIntent: rawClassification.intent,
    profileOverride: effectiveIntent !== rawClassification.intent,
  };

  const brainMax = route.needsSemanticRecall ? 3_000 : 1_500;
  const projectMax = route.needsProjectMemory ? 2_000 : 0;

  let brainBlock = "";
  let projectBlock = "";
  let projectContextStrategy = null;

  if (includeBrainContext && !route.skipBrainContext) {
    try {
      brainBlock = await buildRoutedBrainContext({
        task: message,
        projectId,
        route,
        maxChars: brainMax,
        maxMemories: route.needsSemanticRecall ? 8 : 4,
      });
    } catch {
      brainBlock = "";
    }
  }

  if (includeBrainContext && projectId && route.needsProjectMemory) {
    try {
      const proj = await buildRoutedProjectContext({
        task: message,
        projectId,
        route,
        maxChars: projectMax || 2_000,
      });
      projectBlock = proj.block;
      projectContextStrategy = proj.strategy;
    } catch {
      projectBlock = "";
    }
  }

  const routerHint = buildContextRouterHint(route);
  const toolIntentHint = buildToolIntentHint(toolClassification);
  const brainIntentHint = buildBrainIntentHint(message);
  const planningBlock = buildToolPlanningBlock({
    intent: toolClassification.intent,
    route,
    chatProfile: profile.id,
    chatMode: isChatMode(chatMode) ? chatMode : profile.mode,
  });

  const contextHints = [
    buildAgentLoopHint("observe"),
    planningBlock,
    routerHint,
    toolIntentHint,
    brainIntentHint,
    historySummaryBlock,
    projectBlock,
    brainBlock,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    route,
    toolIntent: toolClassification.intent,
    toolClassification,
    brainBlock,
    projectBlock,
    contextHints,
    conversationId,
    meta: {
      brainContextInjected: !!brainBlock,
      projectContextInjected: !!projectBlock,
      projectContextStrategy,
      contextStrategy: route.reasons,
      toolIntent: effectiveIntent,
      toolIntentSource: toolClassification.source,
      modelVersion: toolClassification.modelVersion,
      chatProfile: profile.id,
      chatMode: isChatMode(chatMode) ? chatMode : profile.mode,
      agentLoopPhase: "observe",
    },
  };
}
