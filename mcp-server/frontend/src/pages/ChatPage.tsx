import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Menu, PanelRight, Sparkles } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatComposer, type ChatComposerHandle } from "@/components/chat/ChatComposer";
import { RunTracePanel, dispatchRunStepEvent } from "@/components/chat/RunTracePanel";
import { apiGet, type ChatModelsData, type PluginInfo } from "@/lib/api-client";
import { getConversation, updateConversation } from "@/lib/conversations-api";
import {
  buildSystemPromptFromSettings,
  DEFAULT_CONVERSATION_SETTINGS,
  parseConversationSettings,
  type ConversationSettings,
} from "@/lib/chat-instructions";
import { ChatInstructionsSheet } from "@/components/chat/ChatInstructionsSheet";
import {
  streamChat,
  submitChatApproval,
  type ApprovalPayload,
  type ChatMessage,
} from "@/lib/chat-stream";
import { useToast } from "@/providers/ToastProvider";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { useSpeechSynthesis } from "@/lib/use-speech-synthesis";
import { parsePluginSlashMessage } from "@/lib/chat-plugin-slash";
import type { SlashPluginOption } from "@/components/chat/ChatSlashMenu";

let messageIdSeq = 0;
function nextMessageId() {
  return `msg-${++messageIdSeq}`;
}

function mapServerMessages(
  messages: Array<{ id: string; role: string; content: string; metadata?: Record<string, unknown> | null; createdAt?: string }>
) {
  return messages.map((m) => ({
    id: m.id,
    role: m.role as ChatMessage["role"],
    content: m.content,
    toolName: m.metadata?.toolName as string | undefined,
    toolPhase: m.metadata?.toolPhase as "start" | "end" | undefined,
    usage: m.metadata?.usage as ChatMessage["usage"],
    createdAt: m.createdAt,
  }));
}

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get("c");
  const [messages, setMessages] = useState<Array<ChatMessage & { id: string; createdAt?: string }>>([]);
  const [input, setInput] = useState(() => searchParams.get("prompt") || "");
  const [streaming, setStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [chatSettings, setChatSettings] = useState<ConversationSettings>({
    ...DEFAULT_CONVERSATION_SETTINGS,
  });
  const [approval, setApproval] = useState<ApprovalPayload | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(() => searchParams.get("run"));
  const [traceOpen, setTraceOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePlugin, setActivePlugin] = useState<string | null>(null);
  const approvalResolve = useRef<((v: boolean) => void) | null>(null);
  const assistantIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const userSelectedConversationRef = useRef<string | null>(null);
  const toast = useToast();
  const sendRef = useRef<(text?: string) => void>(() => {});
  const qc = useQueryClient();

  const speech = useSpeechRecognition({
    onInterim: (t) => setInput(t),
    onFinal: (t) => {
      if (t) void sendRef.current(t);
    },
  });
  const tts = useSpeechSynthesis();

  const { data: modelsData, isLoading: modelsLoading, isError: modelsError } = useQuery({
    queryKey: ["chat-models"],
    queryFn: () => apiGet<ChatModelsData>("/ui/chat/models"),
    retry: 1,
  });

  const conversationQuery = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getConversation(conversationId!),
    enabled: !!conversationId && modelsData?.persistenceEnabled !== false,
    retry: false,
  });

  const { data: plugins = [] } = useQuery({
    queryKey: ["plugins"],
    queryFn: () => apiGet<PluginInfo[]>("/plugins"),
    staleTime: 60_000,
  });

  const pluginNames = useMemo(() => plugins.map((p) => p.name.toLowerCase()), [plugins]);
  const slashPlugins: SlashPluginOption[] = useMemo(
    () =>
      plugins.map((p) => ({
        name: p.name,
        description: p.description,
        toolCount: Array.isArray(p.tools) ? p.tools.length : 0,
      })),
    [plugins]
  );

  useEffect(() => {
    if (streaming || !conversationId) return;

    if (conversationQuery.data?.id !== conversationId) return;

    const serverMessages = mapServerMessages(conversationQuery.data.messages ?? []);

    if (userSelectedConversationRef.current === conversationId) {
      setMessages(serverMessages);
      userSelectedConversationRef.current = null;
      return;
    }

    setMessages((prev) => {
      if (serverMessages.length >= prev.length) return serverMessages;
      return prev;
    });
  }, [conversationQuery.data, conversationId, streaming]);

  useEffect(() => {
    if (conversationQuery.data?.metadata) {
      setChatSettings(parseConversationSettings(conversationQuery.data.metadata));
    } else if (!conversationId) {
      setChatSettings({ ...DEFAULT_CONVERSATION_SETTINGS });
    }
  }, [conversationQuery.data?.metadata, conversationId]);

  useEffect(() => {
    if (streaming) return;
    const id = window.requestAnimationFrame(() => {
      composerRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [streaming]);

  const selectConversation = useCallback(
    (id: string | null) => {
      userSelectedConversationRef.current = id;
      if (id) {
        setSearchParams({ c: id });
      } else {
        setSearchParams({});
        setMessages([]);
      }
      setSidebarOpen(false);
      requestAnimationFrame(() => composerRef.current?.focus());
    },
    [setSearchParams]
  );

  const handleSaveSettings = useCallback(
    async (settings: ConversationSettings) => {
      setChatSettings(settings);
      if (conversationId && modelsData?.persistenceEnabled !== false) {
        await updateConversation(conversationId, { metadata: settings });
        qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      }
    },
    [conversationId, modelsData?.persistenceEnabled, qc]
  );

  const effectiveModel =
    customModel.trim() || model || conversationQuery.data?.model || modelsData?.defaultModel || "";

  const waitApproval = useCallback((payload: ApprovalPayload) => {
    return new Promise<boolean>((resolve) => {
      setApproval(payload);
      approvalResolve.current = resolve;
    });
  }, []);

  const handleApproval = async (approved: boolean) => {
    if (!approval) return;
    try {
      await submitChatApproval(approval.approvalId, approved);
      approvalResolve.current?.(approved);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Onay hatası", "error");
      approvalResolve.current?.(false);
    }
    setApproval(null);
    approvalResolve.current = null;
  };

  const send = async (text?: string) => {
    const raw = (text ?? input).trim();
    if (!raw || streaming) return;

    const { message: msg, pluginFilter } = parsePluginSlashMessage(raw, pluginNames, activePlugin);
    if (!msg) {
      toast.show("Mesaj boş olamaz. /eklenti sonrası bir soru yaz.", "error");
      return;
    }

    setInput("");
    setStreaming(true);
    requestAnimationFrame(() => composerRef.current?.focus());

    const turnPlugin = pluginFilter;

    const userId = nextMessageId();
    const assistantId = nextMessageId();
    assistantIdRef.current = assistantId;
    setStreamingMessageId(assistantId);

    setMessages((m) => [
      ...m,
      { id: userId, role: "user", content: msg },
      { id: assistantId, role: "assistant", content: "…" },
    ]);

    let assistantText = "";
    let resolvedConversationId = conversationId;

    const history = messages
      .filter((x) => x.role === "user" || x.role === "assistant")
      .filter((x) => x.content !== "…")
      .map((x) => ({ role: x.role, content: x.content }));

    try {
      await streamChat(msg, history, effectiveModel || undefined, {
        onMeta: (data) => {
          if (data.conversationId && typeof data.conversationId === "string") {
            resolvedConversationId = data.conversationId;
            if (!conversationId) {
              const params: Record<string, string> = { c: data.conversationId };
              if (typeof data.runId === "string") params.run = data.runId;
              setSearchParams(params, { replace: true });
            }
          }
          if (typeof data.runId === "string") {
            setActiveRunId(data.runId);
          }
        },
        onRunStep: (data) => {
          if (typeof data.runId === "string") {
            dispatchRunStepEvent({
              runId: data.runId,
              type: typeof data.type === "string" ? data.type : "tool",
              toolName: typeof data.toolName === "string" ? data.toolName : undefined,
              phase: typeof data.phase === "string" ? data.phase : undefined,
              status: typeof data.status === "string" ? data.status : "pending",
            });
          }
        },
        onToken: (t) => {
          assistantText += t;
          const targetId = assistantIdRef.current;
          setMessages((m) =>
            m.map((row) => (row.id === targetId ? { ...row, content: assistantText } : row))
          );
        },
        onTool: (data) => {
          const preview =
            data.phase === "start"
              ? `${JSON.stringify(data.arguments || {}, null, 2).slice(0, 500)}`
              : `${JSON.stringify(data.result).slice(0, 600)}`;
          setMessages((m) => [
            ...m,
            {
              id: nextMessageId(),
              role: "tool",
              content: preview,
              toolName: data.name,
              toolPhase: data.phase as "start" | "end",
            },
          ]);
        },
        onApproval: async (payload) => {
          setMessages((m) => [
            ...m,
            { id: nextMessageId(), role: "tool", content: `Onay bekleniyor: ${payload.tool}` },
          ]);
          const ok = await waitApproval(payload);
          setMessages((m) => [
            ...m,
            {
              id: nextMessageId(),
              role: "tool",
              content: ok ? `Onaylandı` : `Reddedildi`,
              toolName: payload.tool,
              toolPhase: "end",
            },
          ]);
        },
        onDone: (data) => {
          const targetId = assistantIdRef.current;
          const usage = data.usage as ChatMessage["usage"] | undefined;
          if (targetId && (usage || data.content)) {
            setMessages((m) =>
              m.map((row) =>
                row.id === targetId
                  ? {
                      ...row,
                      content: typeof data.content === "string" ? data.content : row.content,
                      usage: usage ?? row.usage,
                    }
                  : row
              )
            );
          }
          if (resolvedConversationId) {
            qc.invalidateQueries({ queryKey: ["conversations"] });
            qc.invalidateQueries({ queryKey: ["conversation", resolvedConversationId] });
          }
        },
        onError: (err) => {
          const targetId = assistantIdRef.current;
          setMessages((m) =>
            m.map((row) => (row.id === targetId ? { ...row, content: `Hata: ${err}` } : row))
          );
        },
      }, {
        conversationId: conversationId || undefined,
        autoCreate: !conversationId,
        systemPrompt: buildSystemPromptFromSettings(chatSettings),
        includeBrainContext: chatSettings.includeBrainContext !== false,
        responseStyle: chatSettings.responseStyle,
        pluginFilter: turnPlugin,
      });

      if (!assistantText) {
        const targetId = assistantIdRef.current;
        setMessages((m) =>
          m.map((row) => (row.id === targetId ? { ...row, content: "(boş yanıt)" } : row))
        );
      } else {
        tts.speak(assistantText);
      }
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Chat hatası", "error");
      const targetId = assistantIdRef.current;
      setMessages((m) =>
        m.map((row) =>
          row.id === targetId
            ? { ...row, content: `Hata: ${e instanceof Error ? e.message : "unknown"}` }
            : row
        )
      );
    } finally {
      setStreaming(false);
      setStreamingMessageId(null);
      assistantIdRef.current = null;
      composerRef.current?.focus();
    }
  };

  sendRef.current = send;

  const modelOptions = useMemo(() => {
    const fromApi = modelsData?.selectableModels?.length
      ? modelsData.selectableModels
      : (modelsData?.availableModels ?? modelsData?.models?.filter((m) => m.available) ?? [])
          .flatMap((m) => m.models || [])
          .filter((n, i, arr) => n && arr.indexOf(n) === i);
    const saved = conversationQuery.data?.model;
    const merged = [...fromApi];
    if (saved && !merged.includes(saved)) merged.unshift(saved);
    if (modelsData?.defaultModel && !merged.includes(modelsData.defaultModel)) {
      merged.unshift(modelsData.defaultModel);
    }
    return merged;
  }, [modelsData, conversationQuery.data?.model]);

  const sidebar = (
    <ChatSidebar
      activeId={conversationId}
      onSelect={selectConversation}
      persistenceEnabled={modelsData?.persistenceEnabled}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        <div className="hidden h-full min-h-0 shrink-0 md:flex">{sidebar}</div>

        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <motion.header
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0 rounded-xl md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex h-full w-80 flex-col border-border/60 p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Sohbetler</SheetTitle>
                  </SheetHeader>
                  {sidebar}
                </SheetContent>
              </Sheet>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/15 to-accent/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-sm font-semibold">
                    {conversationQuery.data?.title || "Yeni sohbet"}
                  </h1>
                  <AnimatePresence>
                    {streaming && (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                        <Badge variant="success" className="gap-1 text-[10px]">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                          </span>
                          Yazıyor
                        </Badge>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {modelsLoading
                    ? "Modeller yükleniyor…"
                    : modelsError
                      ? "Model listesi alınamadı"
                      : `${modelsData?.provider ?? "—"} · ${modelsData?.toolCount ?? 0} araç`}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl"
                title="Run trace"
                onClick={() => setTraceOpen((o) => !o)}
              >
                <PanelRight className="h-4 w-4" />
              </Button>
              <ChatInstructionsSheet
                settings={chatSettings}
                persistenceEnabled={modelsData?.persistenceEnabled !== false}
                onSave={handleSaveSettings}
                disabled={modelsLoading}
              />
              <Select
                value={model || conversationQuery.data?.model || modelsData?.defaultModel || ""}
                onValueChange={(v) => {
                  setCustomModel("");
                  setModel(v);
                }}
                disabled={modelsLoading || !modelsData}
              >
              <SelectTrigger className="w-[min(180px,36vw)] rounded-xl border-border/60 bg-card/60 backdrop-blur-sm">
                <Sparkles className="mr-2 h-3.5 w-3.5 shrink-0 text-primary" />
                <SelectValue placeholder="Model seç" />
              </SelectTrigger>
              <SelectContent>
                {(modelOptions.length ? modelOptions : [modelsData?.defaultModel || "default"]).map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="hidden w-[min(140px,30vw)] rounded-xl border-border/60 bg-card/60 sm:block"
              placeholder="Özel model"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              disabled={modelsLoading}
              title="Sunucudaki herhangi bir model adını yazabilirsiniz"
            />
            </div>
          </motion.header>

          <AnimatePresence>
            {modelsData?.providerAvailable === false && modelsData.providerHint && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="shrink-0 overflow-hidden px-4 pt-3"
              >
                <Alert variant="warning">
                  <AlertDescription>{modelsData.providerHint}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <ChatMessageList
              messages={messages}
              streaming={streaming}
              streamingMessageId={streamingMessageId}
              onExample={send}
              scrollRef={scrollRef}
            />
          </div>

          <ChatComposer
            ref={composerRef}
            input={input}
            streaming={streaming}
            speechSupported={speech.supported}
            speechListening={speech.listening}
            ttsEnabled={tts.enabled}
            ttsSupported={tts.supported}
            plugins={slashPlugins}
            activePlugin={activePlugin}
            onActivePluginChange={setActivePlugin}
            onInputChange={setInput}
            onSend={() => send()}
            onSpeechStart={() => speech.start()}
            onSpeechStop={() => speech.stop()}
            onTtsToggle={tts.toggle}
          />
        </div>

        {traceOpen && (
          <div className="hidden h-full min-h-0 w-72 shrink-0 border-l border-border/60 bg-card/30 lg:flex xl:w-80">
            <RunTracePanel runId={activeRunId} live={streaming} className="w-full" />
          </div>
        )}
      </div>

      <Dialog open={!!approval} onOpenChange={(open) => !open && handleApproval(false)}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <div className="border-b border-border/60 bg-amber-500/10 px-6 py-4">
            <DialogHeader>
              <DialogTitle>Araç onayı gerekli</DialogTitle>
              <DialogDescription>
                Bu işlem politika gereği onayını istiyor. Devam etmeden önce parametreleri kontrol et.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-3 px-6 py-4">
            <p className="font-mono text-sm font-medium text-primary">{approval?.tool}</p>
            <pre className="max-h-48 overflow-auto rounded-xl border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed">
              {JSON.stringify(approval?.arguments ?? {}, null, 2)}
            </pre>
          </div>
          <DialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-4">
            <Button variant="outline" onClick={() => handleApproval(false)}>
              Reddet
            </Button>
            <Button variant="destructive" onClick={() => handleApproval(true)}>
              Onayla ve çalıştır
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
