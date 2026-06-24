import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Sparkles, Wrench, Zap } from "lucide-react";
import { ChatAssistantTurn } from "./ChatAssistantTurn";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { groupChatMessages } from "./chat-message-groups";
import type { ChatMessage } from "@/lib/chat-stream";
import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  { text: "Merhaba, kendini tanıt", icon: Sparkles },
  { text: "Policy kurallarını listele", icon: Zap },
  { text: "Hub health durumunu özetle", icon: Wrench },
  { text: "Yüklü araçları listele", icon: Bot },
];

type ChatMessageListProps = {
  messages: Array<ChatMessage & { id: string; createdAt?: string }>;
  streaming: boolean;
  streamingMessageId?: string | null;
  onExample: (text: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
};

export function ChatMessageList({
  messages,
  streaming,
  streamingMessageId,
  onExample,
  scrollRef,
}: ChatMessageListProps) {
  const innerScrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = scrollRef ?? innerScrollRef;
  const renderItems = useMemo(() => groupChatMessages(messages), [messages]);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 120;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollContainerRef]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: streaming ? "auto" : "smooth" });
  }, [messages, streaming, scrollContainerRef]);

  return (
    <div
      ref={scrollContainerRef}
      className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-smooth"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.55_0.14_280/0.12),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,oklch(0.5_0.12_300/0.08),transparent)]" />

      <div className="relative mx-auto max-w-3xl px-4 pb-4 pt-6 md:px-6">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center py-16 text-center"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.05, duration: 0.4 }}
                className="relative mb-6"
              >
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 to-accent/10 shadow-lg shadow-primary/10">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-xl font-semibold tracking-tight"
              >
                MCP Hub ile sohbet et
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground"
              >
                Araçları kullanan akıllı asistanınla konuş. Yeni bir sohbet başlat veya aşağıdaki
                örneklerden birini dene.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-8 grid w-full max-w-lg gap-2 sm:grid-cols-2"
              >
                {EXAMPLE_PROMPTS.map((p, i) => (
                  <motion.button
                    key={p.text}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.05 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onExample(p.text)}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-3 text-left",
                      "shadow-sm backdrop-blur-sm transition-colors hover:border-primary/30 hover:bg-card"
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground transition-colors group-hover:bg-primary/15 group-hover:text-primary">
                      <p.icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm leading-snug text-foreground/90">{p.text}</span>
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="messages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <AnimatePresence initial={false}>
                {renderItems.map((item) => {
                  if (item.type === "user") {
                    return (
                      <ChatMessageBubble
                        key={item.message.id}
                        message={item.message}
                      />
                    );
                  }

                  return (
                    <ChatAssistantTurn
                      key={item.assistant.id}
                      assistant={item.assistant}
                      tools={item.tools}
                      isStreaming={streaming && item.assistant.id === streamingMessageId}
                    />
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
