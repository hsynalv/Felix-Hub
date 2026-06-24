import { Bot, User } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatTime } from "@/lib/utils";
import { formatCostUsd, formatTokenCount } from "@/lib/usage-api";
import type { ChatMessage } from "@/lib/chat-stream";

type ChatMessageBubbleProps = {
  message: ChatMessage & { id: string; createdAt?: string };
  isStreaming?: boolean;
  embedded?: boolean;
};

function StreamingCursor() {
  return (
    <motion.span
      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] rounded-full bg-primary/80"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.55, 1, 0.55] }}
      exit={{ opacity: 0, transition: { duration: 0.35, ease: "easeOut" } }}
      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-chat-dot"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </div>
  );
}

export function ChatMessageBubble({ message, isStreaming, embedded }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const isPlaceholder = message.content === "…";
  const showCursor = isStreaming && !isPlaceholder;
  const showPlainStream = isStreaming && !isPlaceholder;

  const bubble = (
    <>
      <div
        className={cn(
          "relative text-sm leading-relaxed",
          isUser &&
            "rounded-2xl rounded-tr-md bg-gradient-to-br from-primary to-primary/85 px-4 py-2.5 text-primary-foreground shadow-md shadow-primary/15",
          message.role === "assistant" &&
            "rounded-2xl rounded-tl-md border border-border/60 bg-card/90 px-4 py-3 shadow-sm backdrop-blur-sm",
          showPlainStream && "transition-[min-height] duration-300 ease-out"
        )}
      >
        {message.role === "assistant" ? (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-pre:my-2">
            {isPlaceholder && isStreaming ? (
              <ThinkingDots />
            ) : showPlainStream ? (
              <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {message.content}
                <AnimatePresence>
                  {showCursor && <StreamingCursor key="cursor" />}
                </AnimatePresence>
              </span>
            ) : (
              <motion.div
                key="markdown"
                initial={{ opacity: 0.92 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </motion.div>
            )}
          </div>
        ) : (
          <span className="whitespace-pre-wrap">{message.content}</span>
        )}
      </div>

      {(message.createdAt || message.usage?.totalTokens != null) && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-wrap items-center gap-x-2 px-1 text-[10px] text-muted-foreground"
        >
          {message.createdAt && <span>{formatTime(message.createdAt)}</span>}
          {message.usage?.totalTokens != null && (
            <span>
              {formatTokenCount(message.usage.totalTokens)} token
              {message.usage.iterations != null && message.usage.iterations > 1
                ? ` · ${message.usage.iterations} iter`
                : ""}
              {message.usage.estimatedCostUsd != null && message.usage.estimatedCostUsd > 0
                ? ` · ${formatCostUsd(message.usage.estimatedCostUsd)}`
                : ""}
            </span>
          )}
        </motion.span>
      )}
    </>
  );

  if (embedded) {
    return <div className={cn("flex min-w-0 flex-col gap-1.5")}>{bubble}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <Avatar
        className={cn(
          "h-9 w-9 shrink-0 border shadow-sm",
          isUser ? "border-primary/30" : "border-primary/20"
        )}
      >
        <AvatarFallback
          className={cn(
            isUser && "bg-gradient-to-br from-primary to-accent text-primary-foreground",
            !isUser && "bg-gradient-to-br from-primary/20 to-accent/10 text-primary"
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex min-w-0 max-w-[min(85%,42rem)] flex-col gap-1.5", isUser && "items-end")}>
        {bubble}
      </div>
    </motion.div>
  );
}
