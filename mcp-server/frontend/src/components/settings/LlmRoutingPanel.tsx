import { useEffect, useState } from "react";
import { Bot, Loader2, MessageSquare, Route } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SecretInput,
  SettingsInfoBox,
  SettingsSectionCard,
} from "@/components/settings/shared";
import { ApiError } from "@/lib/api-client";
import { fetchLlmConfig, saveLlmConfig, type LlmConfigSnapshot } from "@/lib/settings-api";
import { useToast } from "@/providers/ToastProvider";
import { cn } from "@/lib/utils";

const PROVIDER_LABELS: Record<string, string> = {
  auto: "Otomatik (yapılandırılmış ilk sağlayıcı)",
  openai: "OpenAI (GPT)",
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini)",
  mistral: "Mistral",
  vllm: "vLLM / OpenAI-uyumlu sunucu",
  ollama: "Ollama (yerel)",
};

function ModeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-4 py-3 text-left transition-all",
        active
          ? "border-primary/50 bg-primary/10 shadow-sm shadow-primary/10"
          : "border-border bg-muted/20 hover:border-primary/30"
      )}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

export function LlmRoutingPanel() {
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["llm-config"],
    queryFn: fetchLlmConfig,
    retry: false,
  });

  const [mode, setMode] = useState<"unified" | "split">("split");
  const [unifiedKey, setUnifiedKey] = useState("");
  const [unifiedModel, setUnifiedModel] = useState("gpt-4o-mini");
  const [chatProvider, setChatProvider] = useState("openai");
  const [chatModel, setChatModel] = useState("");
  const [routerProvider, setRouterProvider] = useState("auto");
  const [routerModel, setRouterModel] = useState("");
  const [keys, setKeys] = useState({
    openai: "",
    anthropic: "",
    google: "",
    mistral: "",
    vllmUrl: "",
    vllmKey: "",
  });

  useEffect(() => {
    if (!data) return;
    setMode(data.mode);
    setUnifiedModel(data.unified.model || "gpt-4o-mini");
    setChatProvider(data.chat.provider === "auto" ? "openai" : data.chat.provider);
    setChatModel(data.chat.model || "");
    setRouterProvider(data.router.provider);
    setRouterModel(data.router.model || "");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: saveLlmConfig,
    onSuccess: (res) => {
      qc.setQueryData(["llm-config"], res.snapshot);
      qc.invalidateQueries({ queryKey: ["chat-models"] });
      qc.invalidateQueries({ queryKey: ["settings-env-catalog"] });
      setUnifiedKey("");
      setKeys({ openai: "", anthropic: "", google: "", mistral: "", vllmUrl: "", vllmKey: "" });
      toast.show("LLM yapılandırması kaydedildi");
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Kayıt hatası", "error"),
  });

  const handleSave = () => {
    saveMutation.mutate({
      mode,
      unifiedApiKey: unifiedKey.trim() || undefined,
      unifiedModel: mode === "unified" ? unifiedModel : undefined,
      chatProvider: mode === "split" ? chatProvider : "openai",
      chatModel: mode === "split" ? chatModel : unifiedModel,
      routerProvider: mode === "split" ? routerProvider : "openai",
      routerModel: mode === "split" ? routerModel : unifiedModel,
      providerKeys:
        mode === "split"
          ? {
              openai: keys.openai || undefined,
              anthropic: keys.anthropic || undefined,
              google: keys.google || undefined,
              mistral: keys.mistral || undefined,
              vllmUrl: keys.vllmUrl || undefined,
              vllmKey: keys.vllmKey || undefined,
            }
          : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        LLM ayarları yükleniyor…
      </div>
    );
  }

  const snapshot = data as LlmConfigSnapshot | undefined;

  return (
    <div className="space-y-5">
      <SettingsSectionCard
        icon={Bot}
        title="LLM yapılandırması"
        description="Tek anahtarla tüm LLM'leri kullanın veya sohbet ile router için ayrı sağlayıcı atayın."
      >
        <SettingsInfoBox variant="tip" title="Nasıl çalışır?">
          <strong>Tek anahtar:</strong> Bir OpenAI API anahtarı hem sohbette hem LLM router&apos;da
          kullanılır. <strong>Ayrı atama:</strong> Örneğin GPT sohbet için, Claude router
          görevleri için — her biri kendi anahtarıyla.
        </SettingsInfoBox>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ModeCard
            active={mode === "unified"}
            title="Tek OpenAI anahtarı"
            description="Bir GPT anahtarı tüm LLM ihtiyaçları için yeterli."
            onClick={() => setMode("unified")}
          />
          <ModeCard
            active={mode === "split"}
            title="Ayrı atama"
            description="Sohbet ve router için farklı sağlayıcı ve anahtarlar."
            onClick={() => setMode("split")}
          />
        </div>
      </SettingsSectionCard>

      {mode === "unified" ? (
        <SettingsSectionCard icon={Bot} title="Birleşik OpenAI" description="Sohbet + router">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>OpenAI API anahtarı</Label>
              <SecretInput
                value={unifiedKey}
                onChange={setUnifiedKey}
                placeholder={snapshot?.unified.configured ? "Değiştirmek için yeni anahtar…" : "sk-…"}
              />
              {snapshot?.unified.maskedKey && !unifiedKey && (
                <p className="text-xs text-muted-foreground">Kayıtlı: {snapshot.unified.maskedKey}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Varsayılan model</Label>
              <Input
                value={unifiedModel}
                onChange={(e) => setUnifiedModel(e.target.value)}
                placeholder="gpt-4o-mini"
              />
            </div>
          </div>
        </SettingsSectionCard>
      ) : (
        <>
          <SettingsSectionCard
            icon={MessageSquare}
            title="Sohbet (Chat)"
            description="Web arayüzü sohbet motoru"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Sağlayıcı</Label>
                <Select value={chatProvider} onValueChange={setChatProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(snapshot?.chatProviders ?? ["openai", "vllm", "ollama"]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PROVIDER_LABELS[p] ?? p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  value={chatModel}
                  onChange={(e) => setChatModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                />
              </div>
            </div>
            {chatProvider === "openai" && (
              <p className="mt-2 text-xs text-muted-foreground">
                OpenAI anahtarını aşağıdaki Router bölümünden girin.
              </p>
            )}
            {chatProvider === "vllm" && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>vLLM sunucu URL</Label>
                  <Input
                    value={keys.vllmUrl}
                    onChange={(e) => setKeys((k) => ({ ...k, vllmUrl: e.target.value }))}
                    placeholder="http://localhost:8000/v1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>API anahtarı (opsiyonel)</Label>
                  <SecretInput
                    value={keys.vllmKey}
                    onChange={(v) => setKeys((k) => ({ ...k, vllmKey: v }))}
                    placeholder="not-needed"
                  />
                </div>
              </div>
            )}
            {snapshot?.chat.resolvedProvider && (
              <p className="mt-3 text-xs text-muted-foreground">
                Aktif: <Badge variant="default">{snapshot.chat.resolvedProvider}</Badge>
                {snapshot.chat.configured ? (
                  <Badge variant="success" className="ml-2">
                    hazır
                  </Badge>
                ) : (
                  <Badge variant="warning" className="ml-2">
                    anahtar eksik
                  </Badge>
                )}
              </p>
            )}
          </SettingsSectionCard>

          <SettingsSectionCard
            icon={Route}
            title="LLM Router"
            description="Eklenti görevleri ve araç yönlendirmesi"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Sağlayıcı</Label>
                <Select value={routerProvider} onValueChange={setRouterProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{PROVIDER_LABELS.auto}</SelectItem>
                    {(snapshot?.routerProviders ?? []).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PROVIDER_LABELS[p] ?? p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Varsayılan model</Label>
                <Input
                  value={routerModel}
                  onChange={(e) => setRouterModel(e.target.value)}
                  placeholder="claude-sonnet-4-5"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(["openai", "anthropic", "google", "mistral"] as const).map((id) => {
                const p = snapshot?.providers.find((x) => x.id === id);
                return (
                  <div key={id} className="space-y-2">
                    <Label>{PROVIDER_LABELS[id]} anahtarı</Label>
                    <SecretInput
                      value={keys[id]}
                      onChange={(v) => setKeys((k) => ({ ...k, [id]: v }))}
                      placeholder={p?.maskedKey ? "Değiştirmek için…" : "API anahtarı"}
                    />
                    {p?.maskedKey && !keys[id] && (
                      <p className="text-[11px] text-muted-foreground">Kayıtlı: {p.maskedKey}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <SettingsInfoBox variant="default" title="Örnek">
              GPT sohbet + Claude router: Sohbet → OpenAI, Router → Anthropic seç; her iki anahtarı
              gir.
            </SettingsInfoBox>
          </SettingsSectionCard>
        </>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Kaydet ve uygula
        </Button>
      </div>
    </div>
  );
}
