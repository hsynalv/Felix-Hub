import { useCallback, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { SettingsInfoBox } from "@/components/settings/shared";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import {
  deleteSetting,
  fetchEnvCatalog,
  fetchSettings,
  reloadSettings,
  testPluginConnection,
  upsertSetting,
  type EnvCatalogGroup,
  type EnvCatalogVar,
} from "@/lib/settings-api";
import { useToast } from "@/providers/ToastProvider";

const SOURCE_LABELS: Record<EnvCatalogVar["source"], string> = {
  overlay: "Kayıtlı",
  env: "Sistem",
  unset: "Boş",
};

function EnvValueCell({
  envVar,
  onSave,
  saving,
}: {
  envVar: EnvCatalogVar;
  onSave: (key: string, value: string) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);

  const startEdit = () => {
    setDraft("");
    setShow(false);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft("");
    setShow(false);
  };

  const save = () => {
    if (!draft.trim()) return;
    onSave(envVar.name, draft.trim());
    setEditing(false);
    setDraft("");
    setShow(false);
  };

  if (editing) {
    return (
      <div className="flex min-w-[200px] items-center gap-1">
        <Input
          type={show ? "text" : "password"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={envVar.configured ? "Yeni değer gir…" : "Değer gir…"}
          className="h-8 font-mono text-xs"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
        />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShow((s) => !s)}>
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <Button type="button" size="icon" className="h-8 w-8 shrink-0" disabled={!draft.trim() || saving} onClick={save}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={cancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className={cn(
        "group flex w-full min-w-[160px] items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left font-mono text-xs transition-colors hover:border-border hover:bg-muted/50",
        !envVar.configured && "text-muted-foreground italic"
      )}
    >
      <span className="truncate">{envVar.configured ? envVar.maskedValue : "Ayarlanmadı — tıkla"}</span>
    </button>
  );
}

function PluginEnvGroup({
  group,
  expanded,
  onToggle,
  onSave,
  onDelete,
  savingKey,
  onTest,
  testing,
}: {
  group: EnvCatalogGroup;
  expanded: boolean;
  onToggle: () => void;
  onSave: (key: string, value: string) => void;
  onDelete: (key: string) => void;
  savingKey: string | null;
  onTest?: () => void;
  testing?: boolean;
}) {
  const configuredCount = group.vars.filter((v) => v.configured).length;
  const missingRequired = group.vars.filter((v) => v.required && !v.configured).length;
  const visibleTools = group.tools.slice(0, 4);
  const extraTools = group.tools.length - visibleTools.length;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-3 text-left transition-colors hover:bg-muted/30 rounded-lg -m-1 p-1"
        >
          <span className="mt-0.5 text-muted-foreground">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{group.label}</span>
              {group.version && (
                <Badge className="text-[10px]">v{group.version}</Badge>
              )}
              {group.toolCount > 0 && (
                <Badge variant="default" className="gap-1 text-[10px]">
                  <Wrench className="h-3 w-3" />
                  {group.toolCount} araç
                </Badge>
              )}
              <Badge variant={missingRequired > 0 ? "warning" : configuredCount > 0 ? "success" : "default"} className="text-[10px]">
                {configuredCount}/{group.vars.length} ayarlı
              </Badge>
            </div>
            {group.description && (
              <p className="text-xs text-muted-foreground">{group.description}</p>
            )}
            {group.tools.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {visibleTools.map((tool) => (
                  <span key={tool} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {tool}
                  </span>
                ))}
                {extraTools > 0 && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    +{extraTools} araç
                  </span>
                )}
              </div>
            )}
          </div>
        </button>
        {group.plugin !== "hub" && onTest && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 text-xs"
            disabled={testing}
            onClick={onTest}
          >
            {testing ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="mr-1 h-3.5 w-3.5" />
            )}
            Test
          </Button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[28%]">Değişken</TableHead>
                <TableHead className="w-[36%]">Değer</TableHead>
                <TableHead className="w-[12%]">Kaynak</TableHead>
                <TableHead className="w-[24%] text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.vars.map((envVar) => (
                <TableRow key={`${group.plugin}-${envVar.name}`}>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <code className="text-xs font-semibold">{envVar.name}</code>
                        {envVar.required && <Badge variant="warning" className="text-[10px]">gerekli</Badge>}
                        {!envVar.configured && envVar.required && (
                          <Badge variant="destructive" className="text-[10px]">eksik</Badge>
                        )}
                      </div>
                      {envVar.description && (
                        <p className="text-[11px] leading-snug text-muted-foreground">{envVar.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <EnvValueCell envVar={envVar} onSave={onSave} saving={savingKey === envVar.name} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        envVar.source === "overlay" ? "success" : envVar.source === "env" ? "default" : "warning"
                      }
                      className="text-[10px]"
                    >
                      {SOURCE_LABELS[envVar.source]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {envVar.source === "overlay" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onDelete(envVar.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function PluginEnvPanel() {
  const [search, setSearch] = useState("");
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["hub"]));
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showNewValue, setShowNewValue] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testingPlugin, setTestingPlugin] = useState<string | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    retry: false,
  });

  const catalogQuery = useQuery({
    queryKey: ["settings-env-catalog"],
    queryFn: fetchEnvCatalog,
    retry: false,
  });

  const reloadMutation = useMutation({
    mutationFn: reloadSettings,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["settings-env-catalog"] });
      toast.show(`Yenilendi: ${data.reloaded.join(", ") || "—"}`);
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Reload hatası", "error"),
  });

  const saveMutation = useMutation({
    mutationFn: ({ k, v }: { k: string; v: string }) => upsertSetting(k, v),
    onMutate: ({ k }) => setSavingKey(k),
    onSettled: () => setSavingKey(null),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["settings-env-catalog"] });
      setNewValue("");
      if (data.requiresRestart) {
        toast.show(`${data.keyName} kaydedildi — sunucu yeniden başlatma gerekir`, "warn");
      } else {
        toast.show(`${data.keyName} kaydedildi`);
      }
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Kayıt hatası", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSetting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["settings-env-catalog"] });
      setDeleteTarget(null);
      toast.show("Ayar silindi");
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Silme hatası", "error"),
  });

  const testMutation = useMutation({
    mutationFn: testPluginConnection,
    onMutate: (plugin) => setTestingPlugin(plugin),
    onSettled: () => setTestingPlugin(null),
    onSuccess: (data) => {
      if (data.ok) {
        toast.show(data.message || "Bağlantı testi başarılı");
      } else {
        toast.show(data.message || "Bağlantı testi başarısız", "error");
      }
      queryClient.invalidateQueries({ queryKey: ["marketplace-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["settings-audit"] });
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Test hatası", "error"),
  });

  const handleSave = useCallback(
    (key: string, value: string) => {
      saveMutation.mutate({ k: key, v: value });
    },
    [saveMutation]
  );

  const filteredGroups = useMemo(() => {
    let groups = catalogQuery.data?.groups ?? [];
    const q = search.trim().toLowerCase();

    if (showMissingOnly) {
      groups = groups
        .map((group) => ({
          ...group,
          vars: group.vars.filter((v) => v.required && !v.configured),
        }))
        .filter((g) => g.vars.length > 0);
    }

    if (!q) return groups;

    return groups
      .map((group) => {
        const pluginMatch =
          group.label.toLowerCase().includes(q) ||
          group.plugin.toLowerCase().includes(q) ||
          group.tools.some((t) => t.toLowerCase().includes(q));
        const vars = group.vars.filter(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            v.description.toLowerCase().includes(q) ||
            pluginMatch
        );
        if (!vars.length && !pluginMatch) return null;
        return { ...group, vars: pluginMatch ? group.vars : vars };
      })
      .filter((g): g is EnvCatalogGroup => g !== null);
  }, [catalogQuery.data?.groups, search, showMissingOnly]);

  const filteredUnassigned = useMemo(() => {
    const items = catalogQuery.data?.unassigned ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((v) => v.name.toLowerCase().includes(q));
  }, [catalogQuery.data?.unassigned, search]);

  const toggleGroup = (plugin: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(plugin)) next.delete(plugin);
      else next.add(plugin);
      return next;
    });
  };

  const expandAll = () => {
    setExpanded(new Set(filteredGroups.map((g) => g.plugin)));
  };

  const collapseAll = () => setExpanded(new Set());

  const meta = settingsQuery.data;
  const loading = catalogQuery.isLoading || settingsQuery.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SettingsInfoBox variant="tip">
          Bir değere tıklayarak düzenleyebilirsiniz. <strong>Kayıtlı</strong> değerler uygulama
          üzerinden güvenli şekilde saklanır; <strong>Sistem</strong> değerleri sunucu
          yapılandırmasından okunur. Her satırın altında ilgili eklentinin araçları listelenir.
        </SettingsInfoBox>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Tümünü aç
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Tümünü kapat
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={reloadMutation.isPending}
            onClick={() => reloadMutation.mutate()}
          >
            {reloadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            Yenile
          </Button>
        </div>
      </div>

      {meta && (
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            status={meta.persistenceHealthy ? "healthy" : "degraded"}
            label={`Depolama: ${meta.persistenceHealthy ? "aktif" : "sorunlu"}`}
          />
          <StatusBadge
            status={meta.masterKeyConfigured ? "ok" : "warning"}
            label={`Güvenlik: ${meta.masterKeyConfigured ? "hazır" : "eksik"}`}
          />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Eklenti, araç veya ayar ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant={showMissingOnly ? "default" : "outline"}
          size="sm"
          className="shrink-0"
          onClick={() => setShowMissingOnly((v) => !v)}
        >
          Yalnızca eksik zorunlu
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Yükleniyor…
        </div>
      ) : catalogQuery.isError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
          Env kataloğu yüklenemedi.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => (
            <PluginEnvGroup
              key={group.plugin}
              group={group}
              expanded={expanded.has(group.plugin)}
              onToggle={() => toggleGroup(group.plugin)}
              onSave={handleSave}
              onDelete={setDeleteTarget}
              savingKey={savingKey}
              onTest={
                group.plugin !== "hub"
                  ? () => testMutation.mutate(group.plugin)
                  : undefined
              }
              testing={testingPlugin === group.plugin}
            />
          ))}

          {filteredUnassigned.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <div className="font-medium">Diğer ayarlar</div>
                <p className="text-xs text-muted-foreground">
                  Eklenti listesinde yer almayan, ancak kayıtlı özel yapılandırma anahtarları
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Değişken</TableHead>
                    <TableHead>Değer</TableHead>
                    <TableHead>Kaynak</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnassigned.map((envVar) => (
                    <TableRow key={envVar.name}>
                      <TableCell>
                        <code className="text-xs font-semibold">{envVar.name}</code>
                      </TableCell>
                      <TableCell>
                        <EnvValueCell envVar={envVar} onSave={handleSave} saving={savingKey === envVar.name} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="success" className="text-[10px]">Kayıtlı</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeleteTarget(envVar.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" />
          Yeni ayar ekle
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase())}
            placeholder="Ayar adı (ör. OPENAI_API_KEY)"
            className="font-mono text-sm"
          />
          <div className="flex gap-2">
            <Input
              type={showNewValue ? "text" : "password"}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Değer"
              className="font-mono text-sm"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setShowNewValue((s) => !s)}>
              {showNewValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <Button
            disabled={!newKey.trim() || !newValue.trim() || saveMutation.isPending}
            onClick={() => {
              handleSave(newKey.trim(), newValue.trim());
              setNewKey("");
            }}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
          </Button>
        </div>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Değeri sil</DialogTitle>
            <DialogDescription>
              <code className="font-mono">{deleteTarget}</code> kalıcı olarak silinsin mi? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
