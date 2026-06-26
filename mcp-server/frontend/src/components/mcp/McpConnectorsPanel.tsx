import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cable, Eye, EyeOff, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/layout/StatusBadge";
import {
  createMcpConnector,
  deleteMcpConnector,
  disableMcpConnector,
  enableMcpConnector,
  fetchMcpConnectorTemplates,
  fetchMcpConnectors,
  testMcpConnector,
  updateMcpConnector,
  type McpConnector,
  type McpConnectorInput,
  type McpConnectorTemplate,
} from "@/lib/mcp-connectors-api";
import { fetchEnvCatalog, upsertSetting } from "@/lib/settings-api";
import { useToast } from "@/providers/ToastProvider";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DialogMode = "create" | "edit";

function ConnectorEnvKeyField({
  envKey,
  configured,
  maskedValue,
  value,
  onChange,
}: {
  envKey: string;
  configured: boolean;
  maskedValue?: string | null;
  value: string;
  onChange: (value: string) => void;
}) {
  const [show, setShow] = useState(false);
  const isEditing = value.length > 0;
  const canRevealStored = configured && !!maskedValue && !isEditing;

  useEffect(() => {
    setShow(false);
  }, [envKey, configured, maskedValue, isEditing]);

  const inputValue = isEditing ? value : show && canRevealStored ? maskedValue! : "";
  const inputType = isEditing ? (show ? "text" : "password") : show && canRevealStored ? "text" : "password";

  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={`env-${envKey}`}>{envKey}</Label>
        {configured ? (
          <Badge variant="outline" className="font-mono text-[10px]">
            kayıtlı
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">
            eksik
          </Badge>
        )}
      </div>
      <div className="relative">
        <Input
          id={`env-${envKey}`}
          type={inputType}
          readOnly={canRevealStored && show}
          autoComplete="off"
          placeholder={
            configured
              ? isEditing
                ? "Yeni değer girerek güncelle"
                : show
                  ? ""
                  : "Görmek için göz ikonuna tıkla"
              : "API anahtarı"
          }
          value={inputValue}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10 font-mono text-xs"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full w-9 shrink-0"
          disabled={!configured && !isEditing}
          aria-label={show ? "Anahtarı gizle" : "Anahtarı göster"}
          onClick={() => setShow((prev) => !prev)}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function ConnectorCard({
  connector,
  toggling,
  onEdit,
  onToggle,
  onTest,
  onDelete,
  testing,
}: {
  connector: McpConnector;
  toggling: boolean;
  onEdit: () => void;
  onTest: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
  testing: boolean;
}) {
  const health = connector.enabled
    ? connector.lastHealth === "ok"
      ? "ok"
      : connector.lastHealth === "fail"
        ? "error"
        : "warning"
    : "disabled";

  return (
    <Card className={cn("h-full transition-colors", !connector.enabled && "opacity-80")}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{connector.displayName}</CardTitle>
          <div className="flex flex-wrap justify-end gap-1">
            <Badge variant="outline" className="font-mono text-[10px]">
              {connector.slug}
            </Badge>
            <StatusBadge
              status={health}
              label={connector.enabled ? connector.lastHealth || "unknown" : "disabled"}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="font-mono text-xs text-muted-foreground">
          {connector.command} {connector.args.join(" ")}
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{connector.toolCount} tools</span>
          {connector.envKeys?.length ? <span>{connector.envKeys.length} env</span> : null}
          {connector.lastError ? (
            <span className="text-destructive line-clamp-1" title={connector.lastError}>
              {connector.lastError}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={connector.enabled}
              disabled={toggling}
              onCheckedChange={(checked) => onToggle(checked)}
              aria-label={`${connector.displayName} enable`}
            />
            <span className="text-xs text-muted-foreground">{connector.enabled ? "Açık" : "Kapalı"}</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onTest} disabled={testing}>
            <Zap className="mr-1 h-3 w-3" />
            Test
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onEdit}>
            <Pencil className="mr-1 h-3 w-3" />
            Düzenle
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive"
            onClick={onDelete}
            disabled={connector.enabled}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Sil
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function McpConnectorDialog({
  open,
  mode,
  connector,
  templates,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  mode: DialogMode;
  connector: McpConnector | null;
  templates: McpConnectorTemplate[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [command, setCommand] = useState("npx");
  const [argsJson, setArgsJson] = useState('["-y"]');
  const [envKeysText, setEnvKeysText] = useState("");
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const envCatalogQuery = useQuery({
    queryKey: ["env-catalog"],
    queryFn: fetchEnvCatalog,
    enabled: open,
    staleTime: 30_000,
  });

  const envStateByKey = useMemo(() => {
    const map = new Map<string, { configured: boolean; maskedValue?: string | null }>();
    for (const group of envCatalogQuery.data?.groups ?? []) {
      for (const v of group.vars) {
        map.set(v.name, { configured: v.configured, maskedValue: v.maskedValue });
      }
    }
    for (const v of envCatalogQuery.data?.unassigned ?? []) {
      map.set(v.name, { configured: v.configured, maskedValue: v.maskedValue });
    }
    return map;
  }, [envCatalogQuery.data]);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && connector) {
      setSlug(connector.slug);
      setDisplayName(connector.displayName);
      setCommand(connector.command);
      setArgsJson(JSON.stringify(connector.args ?? [], null, 2));
      setEnvKeysText((connector.envKeys ?? []).join("\n"));
      setEnvValues({});
      setSelectedTemplate("");
    } else {
      setSlug("");
      setDisplayName("");
      setCommand("npx");
      setArgsJson('["-y"]');
      setEnvKeysText("");
      setEnvValues({});
      setSelectedTemplate("");
    }
  }, [open, mode, connector]);

  const applyTemplate = (templateId: string) => {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setSelectedTemplate(templateId);
    setSlug(t.slug);
    setDisplayName(t.displayName);
    setCommand(t.command);
    setArgsJson(JSON.stringify(t.args, null, 2));
    setEnvKeysText(t.envKeys.join("\n"));
    setEnvValues({});
  };

  const parseEnvKeys = () =>
    envKeysText
      .split(/[\n,]/)
      .map((k) => k.trim())
      .filter(Boolean);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let args: string[];
      try {
        const parsed = JSON.parse(argsJson);
        if (!Array.isArray(parsed) || !parsed.every((a) => typeof a === "string")) {
          throw new Error("args JSON array of strings required");
        }
        args = parsed;
      } catch (e) {
        throw new Error(`Geçersiz args JSON: ${(e as Error).message}`);
      }

      const input: McpConnectorInput = {
        slug: slug.trim().toLowerCase(),
        displayName: displayName.trim() || slug.trim(),
        command: command.trim(),
        args,
        envKeys: parseEnvKeys(),
      };

      for (const [key, value] of Object.entries(envValues)) {
        if (value.trim()) await upsertSetting(key, value.trim());
      }

      if (mode === "edit" && connector) {
        return updateMcpConnector(connector.id, input);
      }
      return createMcpConnector(input);
    },
    onSuccess: () => {
      toast.show(mode === "edit" ? "Bağlantı güncellendi" : "Bağlantı oluşturuldu");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!connector?.id) throw new Error("Önce kaydedin");
      const overrides: Record<string, string> = {};
      for (const [key, value] of Object.entries(envValues)) {
        if (value.trim()) overrides[key] = value.trim();
      }
      return testMcpConnector(connector.id, Object.keys(overrides).length ? overrides : undefined);
    },
    onSuccess: (data) => {
      if (data.ok) toast.show(`${data.toolCount ?? 0} araç bulundu`);
      else toast.show(data.error || "Test başarısız", "error");
      onSaved();
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const envKeys = parseEnvKeys();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,56rem)] max-w-none overflow-y-auto sm:w-[min(92vw,56rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cable className="h-4 w-4" />
            {mode === "edit" ? "Dış MCP düzenle" : "Yeni dış MCP"}
          </DialogTitle>
          <DialogDescription>stdio komutu ve argümanlarla harici MCP sunucusu bağlayın.</DialogDescription>
        </DialogHeader>

        {mode === "create" && templates.length > 0 ? (
          <div className="space-y-2">
            <Label>Şablon</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedTemplate}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="">Özel…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="mcp-slug">Slug</Label>
              <Input
                id="mcp-slug"
                value={slug}
                disabled={mode === "edit"}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="tavily"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="mcp-name">Görünen ad</Label>
              <Input id="mcp-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1 sm:max-w-xs">
            <Label htmlFor="mcp-cmd">Komut</Label>
            <Input
              id="mcp-cmd"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="npx"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="mcp-args">Args (JSON array)</Label>
            <Textarea
              id="mcp-args"
              value={argsJson}
              onChange={(e) => setArgsJson(e.target.value)}
              rows={6}
              className="min-h-[8rem] font-mono text-xs"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="mcp-env-keys">Env anahtarları (satır başına)</Label>
              <Textarea
                id="mcp-env-keys"
                value={envKeysText}
                onChange={(e) => setEnvKeysText(e.target.value)}
                rows={4}
                className="font-mono text-xs"
                placeholder="TAVILY_API_KEY"
              />
            </div>
            {envKeys.length > 0 ? (
              <div className="grid gap-3 content-start">
                <p className="text-xs text-muted-foreground">
                  Kayıtlı anahtarlar maskelenir. Tüm entegrasyonlar için{" "}
                  <Link to="/settings" className="text-primary underline-offset-2 hover:underline">
                    Ayarlar → Entegrasyonlar
                  </Link>
                  .
                </p>
                {envKeys.map((key) => (
                  <ConnectorEnvKeyField
                    key={key}
                    envKey={key}
                    configured={!!envStateByKey.get(key)?.configured}
                    maskedValue={envStateByKey.get(key)?.maskedValue}
                    value={envValues[key] ?? ""}
                    onChange={(next) => setEnvValues((prev) => ({ ...prev, [key]: next }))}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {mode === "edit" && connector ? (
            <Button
              type="button"
              variant="outline"
              disabled={testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              <Zap className="mr-2 h-4 w-4" />
              Test
            </Button>
          ) : null}
          <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function McpConnectorsPanel() {
  const toast = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [editing, setEditing] = useState<McpConnector | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["mcp-connectors"],
    queryFn: fetchMcpConnectors,
  });

  const templatesQuery = useQuery({
    queryKey: ["mcp-connector-templates"],
    queryFn: fetchMcpConnectorTemplates,
  });

  const connectors = data?.connectors ?? [];
  const templates = templatesQuery.data?.templates ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mcp-connectors"] });
    qc.invalidateQueries({ queryKey: ["plugins"] });
    qc.invalidateQueries({ queryKey: ["tools"] });
    qc.invalidateQueries({ queryKey: ["env-catalog"] });
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      setTogglingId(id);
      if (enabled) return enableMcpConnector(id);
      return disableMcpConnector(id);
    },
    onSuccess: (_, { enabled }) => {
      toast.show(enabled ? "Dış MCP etkinleştirildi" : "Dış MCP devre dışı");
      invalidate();
    },
    onError: (e: Error) => toast.show(e.message, "error"),
    onSettled: () => setTogglingId(null),
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      setTestingId(id);
      return testMcpConnector(id);
    },
    onSuccess: (result) => {
      if (result.ok) toast.show(`${result.toolCount ?? 0} araç bulundu`);
      else toast.show(result.error || "Test başarısız", "error");
      invalidate();
    },
    onError: (e: Error) => toast.show(e.message, "error"),
    onSettled: () => setTestingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMcpConnector,
    onSuccess: () => {
      toast.show("Bağlantı silindi");
      invalidate();
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const sorted = useMemo(
    () => [...connectors].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [connectors]
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setDialogMode("create");
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Bağlantı ekle
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <Card className="w-full">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Henüz dış MCP bağlantısı yok. Tavily veya Figma şablonuyla başlayın.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {sorted.map((c) => (
            <ConnectorCard
              key={c.id}
              connector={c}
              toggling={togglingId === c.id}
              testing={testingId === c.id}
              onEdit={() => {
                setDialogMode("edit");
                setEditing(c);
                setDialogOpen(true);
              }}
              onTest={() => testMutation.mutate(c.id)}
              onToggle={(enabled) => toggleMutation.mutate({ id: c.id, enabled })}
              onDelete={() => {
                if (confirm(`"${c.displayName}" silinsin mi?`)) deleteMutation.mutate(c.id);
              }}
            />
          ))}
        </div>
      )}

      <McpConnectorDialog
        open={dialogOpen}
        mode={dialogMode}
        connector={editing}
        templates={templates}
        onOpenChange={setDialogOpen}
        onSaved={invalidate}
      />
    </div>
  );
}
