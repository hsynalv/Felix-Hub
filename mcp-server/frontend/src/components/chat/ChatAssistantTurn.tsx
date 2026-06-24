import { Bot } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatToolActivity } from "./ChatToolActivity";
import type { ChatMessageRow } from "./chat-message-groups";

type ChatAssistantTurnProps = {
  assistant: ChatMessageRow;
  tools: ChatMessageRow[];
  isStreaming?: boolean;
};

export function ChatAssistantTurn({ assistant, tools, isStreaming }: ChatAssistantTurnProps) {
  const hasContent = assistant.content && assistant.content !== "…";

  return (
    <div className="flex gap-3">
      <Avatar className="h-9 w-9 shrink-0 border border-primary/20 shadow-sm">
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-primary">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 max-w-[min(85%,42rem)] flex-col gap-2">
        {tools.length > 0 && <ChatToolActivity tools={tools} />}
        {(hasContent || isStreaming) && (
          <ChatMessageBubble message={assistant} isStreaming={isStreaming} embedded />
        )}
      </div>
    </div>
  );
}
