/**
 * Rolling conversation summary compression
 */

import { routeTask } from "../../plugins/llm-router/index.js";
import {
  getConversation,
  updateConversation,
} from "./conversations.service.js";
import { isPersistenceHealthy } from "../persistence/index.js";
import { CHAT_COMPRESS_THRESHOLD } from "./chat-config.js";

/**
 * @param {string} conversationId
 */
export async function maybeCompressConversation(conversationId) {
  if (!conversationId || !isPersistenceHealthy()) return { compressed: false };

  const conv = await getConversation(conversationId, { includeMessages: true });
  if (!conv?.messages?.length) return { compressed: false };

  const messages = conv.messages;
  if (messages.length < CHAT_COMPRESS_THRESHOLD) return { compressed: false };

  const metadata = conv.metadata || {};
  const summarizedUpToSeq = metadata.summarizedUpToSeq || 0;
  const rawKeep = 10;
  const cutoffSeq = messages[messages.length - rawKeep]?.seq ?? messages[messages.length - rawKeep]?.id;

  const toSummarize = messages.filter(
    (m) => (m.seq ?? 0) > summarizedUpToSeq && (m.seq ?? 0) < (cutoffSeq ?? Infinity)
  );

  if (toSummarize.length < 8) return { compressed: false };

  const transcript = toSummarize
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")
    .slice(0, 12_000);

  const prior = metadata.historySummary ? `Prior summary:\n${metadata.historySummary}\n\n` : "";

  const prompt = `${prior}Summarize this conversation segment for future context. Keep: decisions, preferences, open todos, key facts, tool outcomes. Turkish if conversation is Turkish.

${transcript}`;

  let summary = metadata.historySummary || "";
  try {
    const llmResult = await routeTask("summarize", prompt, { maxTokens: 500, temperature: 0.2 });
    summary = (llmResult?.content || "").trim() || summary;
  } catch {
    return { compressed: false };
  }

  const newMeta = {
    ...metadata,
    historySummary: summary,
    summarizedUpToSeq: toSummarize[toSummarize.length - 1]?.seq ?? summarizedUpToSeq,
  };

  await updateConversation(conversationId, { metadata: newMeta });
  return { compressed: true, summarizedUpToSeq: newMeta.summarizedUpToSeq };
}

/**
 * Build history summary block for system prompt extras.
 */
export function buildHistorySummaryBlock(metadata = {}) {
  if (!metadata.historySummary?.trim()) return "";
  return `## Conversation summary (older turns)\n${metadata.historySummary.trim()}`;
}
