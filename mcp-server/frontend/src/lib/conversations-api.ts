import { apiDelete, apiGet, apiPatch, apiPost } from "./api-client";
import type { ConversationSettings } from "./chat-instructions";

export interface ConversationSummary {
  id: string;
  title: string;
  projectId: string | null;
  model: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  seq: number;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[];
  metadata?: Record<string, unknown> | null;
}

export async function listConversations(limit = 50) {
  const data = await apiGet<{ conversations: ConversationSummary[] }>(
    `/ui/chat/conversations?limit=${limit}`
  );
  return data.conversations ?? [];
}

export async function getConversation(id: string) {
  return apiGet<ConversationDetail>(`/ui/chat/conversations/${id}`);
}

export async function createConversation(opts?: { title?: string; model?: string }) {
  return apiPost<ConversationDetail>("/ui/chat/conversations", opts ?? {});
}

export async function updateConversation(
  id: string,
  opts: { title?: string; model?: string; metadata?: ConversationSettings | Record<string, unknown> }
) {
  return apiPatch<ConversationDetail>(`/ui/chat/conversations/${id}`, opts);
}

export async function deleteConversation(id: string) {
  return apiDelete<{ id: string; archived: boolean }>(`/ui/chat/conversations/${id}`);
}
