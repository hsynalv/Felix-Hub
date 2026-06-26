import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Check,
  Copy,
  Layers,
  RefreshCw,
  Search,
  Tags,
  Wrench,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { apiGet, type PluginInfo } from "@/lib/api-client";
import { useToast } from "@/providers/ToastProvider";
import { cn } from "@/lib/utils";

interface ToolRow {
  name: string;
  description?: string;
  plugin?: string;
  tags?: string[];
  inputSchema?: Record<string, unknown>;
}

function countSchemaFields(schema?: Record<string, unknown>): number {
  const props = schema?.properties;
  if (!props || typeof props !== "object") return 0;
  return Object.keys(props).length;
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border/80 bg-muted/20 text-muted-foreground hover:border-primary/30 hover:bg-muted/40 hover:text-foreground"
      )}
    >
      <span className="max-w-[160px] truncate">{label}</span>
      {count != null && (
        <span className={cn("tabular-nums", active ? "text-primary/80" : "text-muted-foreground/80")}>
          {count}
        </span>
      )}
    </button>
  );
}

export function ToolsPage() {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [pluginFilter, setPluginFilter] = useState("");
  const [selected, setSelected] = useState<ToolRow | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const qc = useQueryClient();

  const { data: plugins = [], isLoading, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["plugins"],
    queryFn: () => apiGet<PluginInfo[]>("/plugins"),
    staleTime: 60_000,
  });

  useEffect(() => {
    const fromUrl = searchParams.get("plugin");
    if (fromUrl) setPluginFilter(fromUrl);
  }, [searchParams]);

  const tools = useMemo(() => {
    const rows: ToolRow[] = [];
    for (const p of plugins) {
      for (const t of (p.tools || []) as ToolRow[]) {
        rows.push({ ...t, plugin: p.name });
      }
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [plugins]);

  const pluginNames = useMemo(() => {
    const names = new Set<string>();
    tools.forEach((t) => t.plugin && names.add(t.plugin));
    return [...names].sort();
  }, [tools]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    tools.forEach((t) => t.tags?.forEach((x) => set.add(x)));
    return [...set].sort();
  }, [tools]);

  const pluginCounts = useMemo(() => {
    const counts = new Map<string, number>();
    tools.forEach((t) => {
      if (t.plugin) counts.set(t.plugin, (counts.get(t.plugin) ?? 0) + 1);
    });
    return pluginNames.map((name) => ({ name, count: counts.get(name) ?? 0 }));
  }, [tools, pluginNames]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    tools.forEach((t) => t.tags?.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1)));
    return tags.map((name) => ({ name, count: counts.get(name) ?? 0 }));
  }, [tools, tags]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tools.filter((t) => {
      const matchSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.plugin?.toLowerCase().includes(q);
      const matchTag = !tag || t.tags?.includes(tag);
      const matchPlugin = !pluginFilter || t.plugin === pluginFilter;
      return matchSearch && matchTag && matchPlugin;
    });
  }, [tools, search, tag, pluginFilter]);

  const stats = useMemo(
    () => ({
      tools: tools.length,
      plugins: pluginNames.length,
      tags: tags.length,
      filtered: filtered.length,
    }),
    [tools.length, pluginNames.length, tags.length, filtered.length]
  );

  const activeFilters = [pluginFilter, tag, search.trim()].filter(Boolean).length;

  const selectPlugin = (name: string) => {
    const next = pluginFilter === name ? "" : name;
    setPluginFilter(next);
    if (next) setSearchParams({ plugin: next });
    else setSearchParams({});
  };

  const selectTag = (name: string) => {
    setTag(tag === name ? "" : name);
  };

  const clearFilters = () => {
    setSearch("");
    setTag("");
    setPluginFilter("");
    setSearchParams({});
  };

  const copySchema = async () => {
    if (!selected) return;
    const text = JSON.stringify(selected.inputSchema ?? {}, null, 2);
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    toast.show("Parametre şeması kopyalandı");
    setTimeout(() => setCopied(false), 2000);
  };

  const lastUpdated = dataUpdatedAt
    ? new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(
        dataUpdatedAt
      )
    : null;

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-6">
      <PageHeader
        title="Araç Kataloğu"
        description="Yüklü eklentilerin sunduğu tüm araçları keşfedin, filtreleyin ve parametrelerini inceleyin."
        actions={
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Son güncelleme {lastUpdated}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetch();
                void qc.invalidateQueries({ queryKey: ["plugins"] });
              }}
              disabled={isFetching}
            >
              <RefreshCw className={cn("mr-1.5 h-4 w-4", isFetching && "animate-spin")} />
              Yenile
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          : [
              { label: "Toplam araç", value: stats.tools, icon: Wrench, hint: "Kayıtlı MCP aracı" },
              { label: "Kaynak eklenti", value: stats.plugins, icon: Layers, hint: "Araç sağlayan eklenti" },
              { label: "Etiket", value: stats.tags, icon: Tags, hint: "Filtreleme için etiket" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                      <s.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
                      <p className="text-[11px] text-muted-foreground">{s.hint}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardContent className="min-w-0 space-y-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Araç adı, açıklama veya eklenti ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
              <span className="tabular-nums">
                {stats.filtered} / {stats.tools} araç
              </span>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearFilters}>
                  <X className="mr-1 h-3 w-3" />
                  Temizle
                </Button>
              )}
            </div>
          </div>

          {pluginCounts.length > 0 && (
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                Eklenti
              </div>
              <div className="scrollbar-chip-row min-w-0 overflow-x-auto overscroll-x-contain scroll-smooth pb-2 [-webkit-overflow-scrolling:touch]">
                <div className="flex w-max flex-nowrap gap-2 pr-2">
                  <FilterChip
                    label="Tüm araçlar"
                    count={tools.length}
                    active={!pluginFilter}
                    onClick={() => {
                      setPluginFilter("");
                      setSearchParams({});
                    }}
                  />
                  {pluginCounts.map(({ name, count }) => (
                    <FilterChip
                      key={name}
                      label={name}
                      count={count}
                      active={pluginFilter === name}
                      onClick={() => selectPlugin(name)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {tagCounts.length > 0 && (
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Tags className="h-3.5 w-3.5" />
                Etiket
              </div>
              <div className="scrollbar-chip-row min-w-0 overflow-x-auto overscroll-x-contain scroll-smooth pb-2 [-webkit-overflow-scrolling:touch]">
                <div className="flex w-max flex-nowrap gap-2 pr-2">
                  <FilterChip
                    label="Tüm etiketler"
                    count={tools.length}
                    active={!tag}
                    onClick={() => setTag("")}
                  />
                  {tagCounts.map(({ name, count }) => (
                    <FilterChip
                      key={name}
                      label={name}
                      count={count}
                      active={tag === name}
                      onClick={() => selectTag(name)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid min-h-[320px] gap-4 lg:h-[min(60vh,520px)] lg:grid-cols-5">
        <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:col-span-3">
          <CardHeader className="shrink-0 border-b border-border/60 py-3">
            <CardTitle className="text-sm font-medium">Araç listesi</CardTitle>
          </CardHeader>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title={tools.length === 0 ? "Henüz kayıtlı araç yok" : "Sonuç bulunamadı"}
              description={
                tools.length === 0
                  ? "Eklentiler yüklendiğinde araçlar burada listelenir. Eklenti sayfasından durumu kontrol edebilirsiniz."
                  : "Farklı bir arama terimi veya filtre deneyin."
              }
              action={
                tools.length === 0 ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/plugins">Eklentilere git</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Filtreleri temizle
                  </Button>
                )
              }
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
              <div className="divide-y divide-border/60">
                {filtered.slice(0, 300).map((t, i) => {
                  const isSelected = selected?.name === t.name;
                  return (
                    <motion.button
                      key={t.name}
                      type="button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.015, 0.3) }}
                      onClick={() => setSelected(t)}
                      className={cn(
                        "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between",
                        isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/20"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm font-medium">{t.name}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {t.description || "Açıklama yok"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge className="border border-border/60 bg-transparent font-normal">
                          {t.plugin}
                        </Badge>
                        {t.tags?.slice(0, 2).map((x) => (
                          <Badge key={x} className="hidden font-normal sm:inline-flex">
                            {x}
                          </Badge>
                        ))}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              {filtered.length > 300 && (
                <p className="border-t border-border/60 px-4 py-2 text-center text-xs text-muted-foreground">
                  İlk 300 sonuç gösteriliyor. Daha dar filtre kullanın.
                </p>
              )}
              </ScrollArea>
            </div>
          )}
        </Card>

        <Card className="hidden min-h-0 min-w-0 flex-col overflow-hidden lg:col-span-2 lg:flex">
          <CardHeader className="flex shrink-0 flex-row items-center justify-between border-b border-border/60 py-3">
            <CardTitle className="text-sm font-medium">Araç detayı</CardTitle>
            {selected && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => void copySchema()}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            {selected ? (
              <div className="min-h-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                <div className="space-y-4 overflow-hidden p-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Araç adı
                    </p>
                    <p className="mt-1 break-all font-mono text-sm font-semibold">{selected.name}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Açıklama
                    </p>
                    <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
                      {selected.description || "Bu araç için açıklama tanımlanmamış."}
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-wrap gap-2">
                    <Badge className="max-w-full truncate border border-border/60 bg-transparent">
                      {selected.plugin}
                    </Badge>
                    {selected.tags?.map((x) => (
                      <Badge key={x} className="max-w-full truncate">
                        {x}
                      </Badge>
                    ))}
                  </div>

                  <div className="min-w-0">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Giriş parametreleri
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {countSchemaFields(selected.inputSchema)} alan
                      </span>
                    </div>
                    <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                      {JSON.stringify(selected.inputSchema ?? {}, null, 2)}
                    </pre>
                    <p className="mt-2 break-words text-xs text-muted-foreground">
                      Sohbet veya otomasyon akışlarında bu aracı çağırırken kullanılacak parametre yapısı.
                    </p>
                  </div>
                </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                <EmptyState
                  icon={Wrench}
                  title="Bir araç seçin"
                  description="Soldaki listeden bir araca tıklayarak açıklama, etiketler ve parametre şemasını görüntüleyin."
                  className="py-8"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 lg:hidden">
          <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-3 text-left">
            <SheetTitle className="text-sm font-medium">Araç detayı</SheetTitle>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            {selected ? (
              <div className="space-y-4 overflow-hidden p-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Araç adı</p>
                  <p className="mt-1 break-all font-mono text-sm font-semibold">{selected.name}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Açıklama</p>
                  <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
                    {selected.description || "Bu araç için açıklama tanımlanmamış."}
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <Badge className="max-w-full truncate border border-border/60 bg-transparent">{selected.plugin}</Badge>
                  {selected.tags?.map((x) => (
                    <Badge key={x} className="max-w-full truncate">
                      {x}
                    </Badge>
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Giriş parametreleri ({countSchemaFields(selected.inputSchema)} alan)
                  </p>
                  <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                    {JSON.stringify(selected.inputSchema ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
