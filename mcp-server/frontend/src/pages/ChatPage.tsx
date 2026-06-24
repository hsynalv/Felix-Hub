import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { KeyRound, Send, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiGet, type ChatModelsData } from "@/lib/api-client";
import { getApiKey } from "@/lib/auth";
import {
  streamChat,
  submitChatApproval,
  type ApprovalPayload,
  type ChatMessage,
} from "@/lib/chat-stream";
import { useToast } from "@/providers/ToastProvider";
import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  "Merhaba, kendini tanıt",
  "Policy kurallarını listele",
  "Hub health durumunu özetle",
];

let messageIdSeq = 0;
function nextMessageId() {
  return `msg-${++messageIdSeq}`;
}

export function ChatPage() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Array<ChatMessage & { id: string }>>([]);
  const [input, setInput] = useState(() => searchParams.get("prompt") || "");
  const [streaming, setStreaming] = useState(false);
  const [model, setModel] = useState("");
  const [approval, setApproval] = useState<ApprovalPayload | null>(null);
  const [hasApiKey, setHasApiKey] = useState(() => !!getApiKey());
  const approvalResolve = useRef<((v: boolean) => void) | null>(null);
  const assistantIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    const sync = () => setHasApiKey(!!getApiKey());
    sync();
    window.addEventListener("storage", sync);
    const interval = setInterval(sync, 1500);
    return () => {
      window.removeEventListener("storage", sync);
      clearInterval(interval);
    };
  }, []);

  const {
    data: modelsData,
    isLoading: modelsLoading,
    isError: modelsError,
  } = useQuery({
    queryKey: ["chat-models"],
    queryFn: () => apiGet<ChatModelsData>("/ui/chat/models"),
    enabled: hasApiKey,
    retry: 1,
  });

  const effectiveModel = model || modelsData?.defaultModel || "";

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
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;

    if (!getApiKey()) {
      toast.show("Önce üst bardan Token al veya API key kaydet", "warn");
      return;
    }

    setInput("");
    setStreaming(true);

    const userId = nextMessageId();
    const assistantId = nextMessageId();
    assistantIdRef.current = assistantId;

    setMessages((m) => [
      ...m,
      { id: userId, role: "user", content: msg },
      { id: assistantId, role: "assistant", content: "…" },
    ]);

    let assistantText = "";

    const history = messages
      .filter((x) => x.role === "user" || x.role === "assistant")
      .filter((x) => x.content !== "…")
      .map((x) => ({ role: x.role, content: x.content }));

    try {
      await streamChat(msg, history, effectiveModel || undefined, {
        onToken: (t) => {
          assistantText += t;
          const targetId = assistantIdRef.current;
          setMessages((m) =>
            m.map((row) => (row.id === targetId ? { ...row, content: assistantText } : row))
          );
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        },
        onTool: (data) => {
          const preview =
            data.phase === "start"
              ? `🔧 ${data.name}\n${JSON.stringify(data.arguments || {}, null, 2).slice(0, 300)}`
              : `✓ ${data.name}: ${JSON.stringify(data.result).slice(0, 400)}`;
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
            { id: nextMessageId(), role: "tool", content: `⏳ Onay: ${payload.tool}` },
          ]);
          const ok = await waitApproval(payload);
          setMessages((m) => [
            ...m,
            {
              id: nextMessageId(),
              role: "tool",
              content: ok ? `✓ ${payload.tool} onaylandı` : `✗ ${payload.tool} reddedildi`,
            },
          ]);
        },
        onError: (err) => {
          const targetId = assistantIdRef.current;
          setMessages((m) =>
            m.map((row) => (row.id === targetId ? { ...row, content: `Hata: ${err}` } : row))
          );
        },
      });

      if (!assistantText) {
        const targetId = assistantIdRef.current;
        setMessages((m) =>
          m.map((row) => (row.id === targetId ? { ...row, content: "(boş yanıt)" } : row))
        );
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
      assistantIdRef.current = null;
    }
  };

  const modelOptions = modelsData?.models
    ?.flatMap((m) => m.models || [])
    .filter((n, i, arr) => arr.indexOf(n) === i);

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-4xl flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">LLM Chat</h1>
          <p className="text-xs text-muted-foreground">
            {!hasApiKey
              ? "API key gerekli"
              : modelsLoading
                ? "Modeller yükleniyor…"
                : modelsError
                  ? "Model listesi alınamadı"
                  : `${modelsData?.provider ?? "—"} · ${effectiveModel || "—"} · ${modelsData?.toolCount ?? 0} tools`}
          </p>
        </div>
        <select
          value={effectiveModel}
          onChange={(e) => setModel(e.target.value)}
          disabled={!hasApiKey || modelsLoading || !modelsData}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {!modelsData ? (
            <option value="">—</option>
          ) : (
            (modelOptions?.length ? modelOptions : [modelsData.defaultModel]).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))
          )}
        </select>
      </div>

      {!hasApiKey && (
        <div className="flex shrink-0 items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-medium">Kimlik doğrulama gerekli</p>
            <p className="text-muted-foreground">
              Üst bardan <strong>Token</strong> (localhost) veya HUB anahtarını <strong>Save</strong> ile kaydet.
            </p>
            <Link to="/settings" className="text-primary underline-offset-2 hover:underline">
              Settings →
            </Link>
          </div>
        </div>
      )}

      {modelsData?.providerAvailable === false && modelsData.providerHint && (
        <div className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {modelsData.providerHint}
        </div>
      )}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="mb-4 text-sm text-muted-foreground">mcp-hub ile sohbet et</p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_PROMPTS.map((p) => (
                  <Button key={p} variant="outline" size="sm" onClick={() => send(p)} disabled={!hasApiKey}>
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                  m.role === "user" && "bg-primary text-primary-foreground",
                  m.role === "assistant" &&
                    "border border-border bg-card prose prose-sm max-w-none dark:prose-invert",
                  m.role === "tool" &&
                    "whitespace-pre-wrap border border-amber-500/30 bg-amber-500/10 font-mono text-xs text-amber-100"
                )}
              >
                {m.role === "assistant" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                ) : (
                  m.content
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border p-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder={hasApiKey ? "Mesaj yaz… (Enter gönder)" : "Önce API key kaydet"}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={streaming || !hasApiKey}
          />
          <Button onClick={() => send()} disabled={streaming || !input.trim() || !hasApiKey}>
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </Card>

      <Dialog open={!!approval} onOpenChange={(open) => !open && handleApproval(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tool onayı gerekli</DialogTitle>
            <DialogDescription>Policy/destructive tool — devam etmek için onayla</DialogDescription>
          </DialogHeader>
          <p className="font-mono text-sm text-primary">{approval?.tool}</p>
          <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted p-3 text-xs">
            {JSON.stringify(approval?.arguments ?? {}, null, 2)}
          </pre>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleApproval(false)}>
              Reddet
            </Button>
            <Button variant="destructive" onClick={() => handleApproval(true)}>
              Onayla
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
