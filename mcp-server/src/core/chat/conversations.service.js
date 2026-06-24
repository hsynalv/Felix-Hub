/**
 * Chat conversations — MSSQL persistence
 */

import {
  persistenceQuery,
  isPersistenceHealthy,
  randomUUID,
} from "../persistence/index.js";

const DEFAULT_NS = "default";

function persistenceRequired() {
  if (!isPersistenceHealthy()) {
    throw Object.assign(new Error("Persistence unavailable"), { code: "persistence_unavailable" });
  }
}

function parseJson(val) {
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

function rowToConversation(row, messageCount = 0) {
  return {
    id: row.id,
    title: row.title || "Yeni sohbet",
    projectId: row.project_id || null,
    namespace: row.namespace,
    model: row.model || null,
    metadata: parseJson(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at || null,
    messageCount,
  };
}

function rowToMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    seq: row.seq,
    role: row.role,
    content: row.content,
    metadata: parseJson(row.metadata_json),
    createdAt: row.created_at,
  };
}

export function generateTitleFromMessage(message) {
  const trimmed = String(message || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "Yeni sohbet";
  return trimmed.length > 48 ? `${trimmed.slice(0, 45)}…` : trimmed;
}

export async function listConversations({
  namespace = DEFAULT_NS,
  projectId = null,
  limit = 50,
  offset = 0,
} = {}) {
  persistenceRequired();
  const inputs = { namespace, limit, offset };
  let projectFilter = "";
  if (projectId) {
    projectFilter = " AND project_id = @projectId";
    inputs.projectId = projectId;
  }

  const result = await persistenceQuery(
    `SELECT c.id, c.title, c.project_id, c.namespace, c.model, c.metadata_json,
            c.created_at, c.updated_at, c.archived_at,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id) AS message_count
     FROM chat_conversations c
     WHERE c.namespace = @namespace AND c.archived_at IS NULL${projectFilter}
     ORDER BY c.updated_at DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    inputs
  );

  return (result?.recordset ?? []).map((r) => rowToConversation(r, r.message_count));
}

export async function getConversation(id, { includeMessages = true, namespace = DEFAULT_NS } = {}) {
  persistenceRequired();
  const result = await persistenceQuery(
    `SELECT TOP 1 id, title, project_id, namespace, model, metadata_json, created_at, updated_at, archived_at
     FROM chat_conversations
     WHERE id = @id AND namespace = @namespace AND archived_at IS NULL`,
    { id, namespace }
  );
  const row = result?.recordset?.[0];
  if (!row) return null;

  const conversation = rowToConversation(row);
  if (!includeMessages) return { ...conversation, messages: [] };

  const msgResult = await persistenceQuery(
    `SELECT id, conversation_id, seq, role, content, metadata_json, created_at
     FROM chat_messages WHERE conversation_id = @id ORDER BY seq ASC`,
    { id }
  );
  conversation.messages = (msgResult?.recordset ?? []).map(rowToMessage);
  return conversation;
}

export async function createConversation({
  title = "Yeni sohbet",
  projectId = null,
  model = null,
  metadata = null,
  namespace = DEFAULT_NS,
} = {}) {
  persistenceRequired();
  const id = randomUUID();
  await persistenceQuery(
    `INSERT INTO chat_conversations (id, title, project_id, namespace, model, metadata_json)
     VALUES (@id, @title, @projectId, @namespace, @model, @metadataJson)`,
    {
      id,
      title,
      projectId,
      namespace,
      model,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    }
  );
  return getConversation(id, { namespace });
}

export async function updateConversation(id, { title, model, metadata, namespace = DEFAULT_NS } = {}) {
  persistenceRequired();
  const sets = ["updated_at = SYSUTCDATETIME()"];
  const inputs = { id, namespace };

  if (title !== undefined) {
    sets.push("title = @title");
    inputs.title = title;
  }
  if (model !== undefined) {
    sets.push("model = @model");
    inputs.model = model;
  }
  if (metadata !== undefined) {
    sets.push("metadata_json = @metadataJson");
    inputs.metadataJson = metadata ? JSON.stringify(metadata) : null;
  }

  await persistenceQuery(
    `UPDATE chat_conversations SET ${sets.join(", ")}
     WHERE id = @id AND namespace = @namespace AND archived_at IS NULL`,
    inputs
  );
  return getConversation(id, { includeMessages: false, namespace });
}

export async function archiveConversation(id, { namespace = DEFAULT_NS } = {}) {
  persistenceRequired();
  await persistenceQuery(
    `UPDATE chat_conversations SET archived_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
     WHERE id = @id AND namespace = @namespace AND archived_at IS NULL`,
    { id, namespace }
  );
  return { id, archived: true };
}

export async function appendMessage(conversationId, { role, content, metadata = null, namespace = DEFAULT_NS }) {
  persistenceRequired();
  const msgId = randomUUID();

  const seqResult = await persistenceQuery(
    `SELECT ISNULL(MAX(seq), 0) + 1 AS next_seq FROM chat_messages WHERE conversation_id = @conversationId`,
    { conversationId }
  );
  const seq = seqResult?.recordset?.[0]?.next_seq ?? 1;

  await persistenceQuery(
    `INSERT INTO chat_messages (id, conversation_id, seq, role, content, metadata_json)
     VALUES (@msgId, @conversationId, @seq, @role, @content, @metadataJson)`,
    {
      msgId,
      conversationId,
      seq,
      role,
      content,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    }
  );

  await persistenceQuery(
    `UPDATE chat_conversations SET updated_at = SYSUTCDATETIME()
     WHERE id = @conversationId AND namespace = @namespace`,
    { conversationId, namespace }
  );

  return { id: msgId, conversationId, seq, role, content, metadata };
}

export async function getConversationHistoryForChat(conversationId, { limit = 20, namespace = DEFAULT_NS } = {}) {
  persistenceRequired();
  const conv = await getConversation(conversationId, { namespace });
  if (!conv) return null;
  const messages = (conv.messages ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-limit)
    .map((m) => ({ role: m.role, content: m.content }));
  return { conversation: conv, history: messages };
}

export async function appendChatExchange(
  conversationId,
  { userMessage, assistantMessage, assistantMetadata = null, toolMessages = [], namespace = DEFAULT_NS, autoTitle = false } = {}
) {
  persistenceRequired();
  if (userMessage) {
    await appendMessage(conversationId, { role: "user", content: userMessage, namespace });
  }
  for (const tool of toolMessages) {
    await appendMessage(conversationId, {
      role: "tool",
      content: tool.content,
      metadata: tool.metadata,
      namespace,
    });
  }
  if (assistantMessage) {
    await appendMessage(conversationId, {
      role: "assistant",
      content: assistantMessage,
      metadata: assistantMetadata,
      namespace,
    });
  }
  if (autoTitle && userMessage) {
    const conv = await getConversation(conversationId, { includeMessages: false, namespace });
    if (conv && (conv.title === "Yeni sohbet" || !conv.title)) {
      await updateConversation(conversationId, { title: generateTitleFromMessage(userMessage), namespace });
    }
  }
}
