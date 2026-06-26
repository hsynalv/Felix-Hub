import type { ChatMessage } from "@/lib/chat-stream";

export type ChatMessageRow = ChatMessage & { id: string; createdAt?: string };

export type MergedToolCall = {
  id: string;
  name: string;
  status: "running" | "done" | "pending" | "denied";
  detail?: string;
  arguments?: Record<string, unknown>;
  summary?: {
    ok?: boolean;
    summary?: string;
    keyFacts?: string[];
    truncated?: boolean;
    rawRef?: { runId?: string; toolName?: string };
  };
};

export type ChatRenderItem =
  | { type: "user"; message: ChatMessageRow }
  | { type: "assistant-turn"; assistant: ChatMessageRow; tools: ChatMessageRow[] };

export function groupChatMessages(messages: ChatMessageRow[]): ChatRenderItem[] {
  const items: ChatRenderItem[] = [];
  let i = 0;

  while (i < messages.length) {
    const message = messages[i];

    if (message.role === "user") {
      items.push({ type: "user", message });
      i += 1;
      continue;
    }

    if (message.role === "assistant") {
      const assistant = message;
      i += 1;
      const tools: ChatMessageRow[] = [];
      while (i < messages.length && messages[i].role === "tool") {
        tools.push(messages[i]);
        i += 1;
      }
      items.push({ type: "assistant-turn", assistant, tools });
      continue;
    }

    if (message.role === "tool") {
      const tools: ChatMessageRow[] = [];
      while (i < messages.length && messages[i].role === "tool") {
        tools.push(messages[i]);
        i += 1;
      }
      items.push({
        type: "assistant-turn",
        assistant: {
          id: `orphan-${tools[0].id}`,
          role: "assistant",
          content: "",
        },
        tools,
      });
      continue;
    }

    i += 1;
  }

  return items;
}

export function mergeToolMessages(tools: ChatMessageRow[]): MergedToolCall[] {
  const byName = new Map<string, MergedToolCall>();
  const extras: MergedToolCall[] = [];

  for (const tool of tools) {
    const name = tool.toolName?.trim();
    if (!name) {
      extras.push({
        id: tool.id,
        name: tool.content.replace(/\s+/g, " ").slice(0, 48),
        status: tool.content.includes("Reddedildi")
          ? "denied"
          : tool.content.includes("Onay")
            ? "pending"
            : "done",
        detail: tool.content,
      });
      continue;
    }

    const entry = byName.get(name) ?? { id: tool.id, name, status: "running" as const };
    if (tool.toolPhase === "start") {
      entry.status = "running";
      entry.detail = tool.content;
      if (tool.toolArguments) entry.arguments = tool.toolArguments;
    } else if (tool.toolPhase === "end") {
      entry.status = "done";
      entry.detail = tool.content;
      if (tool.toolSummary) entry.summary = tool.toolSummary;
    } else {
      entry.detail = tool.content;
      entry.status = "done";
    }
    byName.set(name, entry);
  }

  return [...byName.values(), ...extras];
}

export function shortToolName(name: string) {
  const parts = name.split("_");
  if (parts.length <= 2) return name;
  return parts.slice(-2).join("_");
}
