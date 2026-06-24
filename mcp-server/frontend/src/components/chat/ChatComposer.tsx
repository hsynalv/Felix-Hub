import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Send, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChatSlashMenu, type SlashPluginOption } from "@/components/chat/ChatSlashMenu";
import { filterPlugins, getSlashPaletteState } from "@/lib/chat-plugin-slash";
import { cn } from "@/lib/utils";

type ChatComposerProps = {
  input: string;
  streaming: boolean;
  speechSupported: boolean;
  speechListening: boolean;
  ttsEnabled: boolean;
  ttsSupported: boolean;
  plugins: SlashPluginOption[];
  activePlugin: string | null;
  onActivePluginChange: (plugin: string | null) => void;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onSpeechStart: () => void;
  onSpeechStop: () => void;
  onTtsToggle: () => void;
};

export type ChatComposerHandle = {
  focus: () => void;
};

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer({
  input,
  streaming,
  speechSupported,
  speechListening,
  ttsEnabled,
  ttsSupported,
  plugins,
  activePlugin,
  onActivePluginChange,
  onInputChange,
  onSend,
  onSpeechStart,
  onSpeechStop,
  onTtsToggle,
}, ref) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [slashHighlight, setSlashHighlight] = useState(0);

  useImperativeHandle(ref, () => ({
    focus: () => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
    },
  }));

  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true });
  }, []);
  const slashState = getSlashPaletteState(input);

  const filteredPlugins = useMemo(() => {
    if (!slashState?.open) return [];
    return filterPlugins(plugins, slashState.query);
  }, [plugins, slashState]);

  useEffect(() => {
    setSlashHighlight(0);
  }, [slashState?.query]);

  useEffect(() => {
    if (slashHighlight >= filteredPlugins.length && filteredPlugins.length > 0) {
      setSlashHighlight(filteredPlugins.length - 1);
    }
  }, [filteredPlugins.length, slashHighlight]);

  const selectPlugin = (name: string) => {
    onActivePluginChange(name);
    onInputChange("");
    setSlashHighlight(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashState?.open && filteredPlugins.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashHighlight((i) => (i + 1) % filteredPlugins.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashHighlight((i) => (i - 1 + filteredPlugins.length) % filteredPlugins.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        selectPlugin(filteredPlugins[slashHighlight].name);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        selectPlugin(filteredPlugins[slashHighlight].name);
        return;
      }
    }

    if (e.key === "Escape" && slashState?.open) {
      e.preventDefault();
      onInputChange("");
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const canSend = !streaming && input.trim().length > 0;

  return (
    <TooltipProvider>
      <div className="relative z-10 shrink-0 px-3 pb-2 pt-1 sm:px-4 sm:pb-3">
        <div className="pointer-events-auto relative mx-auto max-w-3xl">
          {slashState?.open && (
            <ChatSlashMenu
              plugins={filteredPlugins}
              highlightIndex={slashHighlight}
              onSelect={selectPlugin}
            />
          )}

          {activePlugin && !slashState?.open && (
            <div className="mb-1.5 flex items-center gap-2">
              <Badge variant="default" className="gap-1 font-mono text-[10px]">
                /{activePlugin}
                <button
                  type="button"
                  className="rounded-sm hover:bg-muted"
                  aria-label="Eklenti filtresini kaldır"
                  onClick={() => onActivePluginChange(null)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
              <span className="text-[10px] text-muted-foreground">Bu mesajda sadece bu eklentinin araçları</span>
            </div>
          )}

          <div
            className={cn(
              "flex items-end gap-2 rounded-2xl border p-2",
              "border-border/50 bg-card/95 shadow-xl shadow-black/10 backdrop-blur-xl",
              "dark:border-border/40 dark:bg-card/90 dark:shadow-black/35",
              speechListening && "border-destructive/40 ring-2 ring-destructive/20"
            )}
          >
            <div className="flex shrink-0 flex-col gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={speechListening ? "destructive" : "ghost"}
                    size="icon"
                    className={cn("h-9 w-9 rounded-xl", speechListening && "animate-pulse")}
                    disabled={streaming || !speechSupported}
                    onMouseDown={onSpeechStart}
                    onMouseUp={onSpeechStop}
                    onMouseLeave={() => speechListening && onSpeechStop()}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      onSpeechStart();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      onSpeechStop();
                    }}
                  >
                    {speechListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Basılı tut ve konuş</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={ttsEnabled ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-xl"
                    disabled={!ttsSupported}
                    onClick={onTtsToggle}
                  >
                    {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sesli yanıt</TooltipContent>
              </Tooltip>
            </div>

            <div className="relative min-w-0 flex-1">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={streaming ? "Yanıt geliyor… bir sonraki mesajını yazabilirsin" : "Mesajını yaz… / ile eklenti seç"}
                className="max-h-40 min-h-[44px] resize-none border-0 bg-transparent px-1 py-2.5 shadow-none focus-visible:ring-0"
              />
              {!input && !streaming && (
                <Sparkles className="pointer-events-none absolute right-2 top-3 h-3.5 w-3.5 text-muted-foreground/40" />
              )}
            </div>

            <motion.div whileTap={{ scale: 0.94 }}>
              <Button
                onClick={onSend}
                disabled={!canSend}
                size="icon"
                className={cn(
                  "h-10 w-10 shrink-0 rounded-xl transition-all",
                  canSend && "bg-gradient-to-br from-primary to-accent shadow-md shadow-primary/25"
                )}
              >
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </motion.div>
          </div>

          <p className="mt-1 text-center text-[10px] leading-tight text-muted-foreground/70">
            <span className="font-mono">/brain</span> gibi eklenti seç · Enter gönder · Shift+Enter satır
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
});
