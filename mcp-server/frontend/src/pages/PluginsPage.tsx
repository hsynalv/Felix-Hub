import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plug, Settings2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/layout/StatusBadge";
import {
  disablePlugin,
  enablePlugin,
  fetchMarketplaceCatalog,
  fetchPluginWizard,
  testPluginConnection,
  type MarketplacePlugin,
} from "@/lib/marketplace-api";
import { useToast } from "@/providers/ToastProvider";
import { cn } from "@/lib/utils";

function maturityTone(status?: string) {
  switch (status) {
    case "stable":
      return "bg-success/15 text-success";
    case "experimental":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    default:
      return "bg-primary/15 text-primary";
  }
}

function PluginCard({
  plugin,
  onSetup,
  onToggle,
  toggling,
}: {
  plugin: MarketplacePlugin;
  onSetup: () => void;
  onToggle: (enabled: boolean) => void;
  toggling: boolean;
}) {
  const toolCount = Array.isArray(plugin.tools) ? plugin.tools.length : 0;
  const enabled = plugin.enabled !== false && plugin.state?.enabled !== false;

  return (
    <Card className={cn("h-full transition-colors", !enabled && "opacity-75")}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{plugin.name}</CardTitle>
          <div className="flex flex-wrap justify-end gap-1">
            {plugin.version && <Badge>v{plugin.version}</Badge>}
            {plugin.maturity && (
              <Badge className={cn("font-mono text-[10px]", maturityTone(plugin.maturity))}>
                {plugin.maturity}
              </Badge>
            )}
            <StatusBadge status={enabled ? "ok" : "disabled"} label={enabled ? "enabled" : "disabled"} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground line-clamp-2">{plugin.description || "—"}</p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{toolCount} tools</span>
          {plugin.state?.lastHealth && <span>health: {plugin.state.lastHealth}</span>}
          {plugin.missingEnv?.length ? (
            <span className="text-amber-600 dark:text-amber-400">{plugin.missingEnv.length} env eksik</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={enabled}
              disabled={toggling}
              onCheckedChange={(checked) => onToggle(checked)}
              aria-label={`${plugin.name} enable`}
            />
            <span className="text-xs text-muted-foreground">{enabled ? "Açık" : "Kapalı"}</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onSetup}>
            <Settings2 className="mr-1 h-3 w-3" />
            Kurulum
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
            <Link to={`/tools?plugin=${encodeURIComponent(plugin.name)}`}>Araçlar</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SetupWizardDialog({
  plugin,
  open,
  onOpenChange,
}: {
  plugin: MarketplacePlugin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();

  const wizardQuery = useQuery({
    queryKey: ["plugin-wizard", plugin?.name],
    queryFn: () => fetchPluginWizard(plugin!.name),
    enabled: open && !!plugin?.name,
  });

  const testMutation = useMutation({
    mutationFn: () => testPluginConnection(plugin!.name),
    onSuccess: (data) => {
      if (data.ok) toast.show(data.message || "Bağlantı testi başarılı");
      else toast.show(data.message || "Test başarısız", "error");
      qc.invalidateQueries({ queryKey: ["marketplace-catalog"] });
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const steps = wizardQuery.data?.steps ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-4 w-4" />
            {plugin?.name} kurulum
          </DialogTitle>
          <DialogDescription>{plugin?.description}</DialogDescription>
        </DialogHeader>

        {wizardQuery.isLoading ? (
          <Skeleton className="h-32 rounded-lg" />
        ) : (
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={step.id} className="rounded-lg border border-border/50 p-3 text-sm">
                <p className="font-medium">
                  {i + 1}. {step.title}
                </p>
                {step.id === "configuration" && plugin?.missingEnv?.length ? (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Eksik: {plugin.missingEnv.join(", ")} — Ayarlar → Entegrasyonlar
                  </p>
                ) : null}
                {step.id === "permissions" && plugin?.riskLevel ? (
                  <p className="mt-1 text-xs text-muted-foreground">Risk: {plugin.riskLevel}</p>
                ) : null}
              </div>
            ))}

            <Button
              className="w-full"
              variant="outline"
              disabled={testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              <Zap className="mr-2 h-4 w-4" />
              Bağlantıyı test et
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PluginsPage() {
  const [search, setSearch] = useState("");
  const [setupPlugin, setSetupPlugin] = useState<MarketplacePlugin | null>(null);
  const [dangerousPlugin, setDangerousPlugin] = useState<MarketplacePlugin | null>(null);
  const [togglingName, setTogglingName] = useState<string | null>(null);
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace-catalog"],
    queryFn: fetchMarketplaceCatalog,
  });

  const plugins = data?.plugins ?? [];

  const toggleMutation = useMutation({
    mutationFn: async ({ name, enabled }: { name: string; enabled: boolean }) => {
      setTogglingName(name);
      if (enabled) return enablePlugin(name);
      return disablePlugin(name);
    },
    onSuccess: (_, { enabled }) => {
      toast.show(enabled ? "Plugin etkinleştirildi" : "Plugin devre dışı bırakıldı");
      qc.invalidateQueries({ queryKey: ["marketplace-catalog"] });
      qc.invalidateQueries({ queryKey: ["plugins"] });
      qc.invalidateQueries({ queryKey: ["tools"] });
    },
    onError: (e: Error) => toast.show(e.message, "error"),
    onSettled: () => setTogglingName(null),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return plugins.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [plugins, search]);

  const handleToggle = (plugin: MarketplacePlugin, enabled: boolean) => {
    const combos = plugin.security?.dangerousCombinations ?? [];
    if (enabled && combos.length > 0) {
      setDangerousPlugin(plugin);
      return;
    }
    toggleMutation.mutate({ name: plugin.name, enabled });
  };

  const confirmDangerousEnable = () => {
    if (!dangerousPlugin) return;
    toggleMutation.mutate({ name: dangerousPlugin.name, enabled: true });
    setDangerousPlugin(null);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title="Plugins"
        description={`${plugins.length} plugin — enable/disable ve bağlantı testi`}
        actions={
          <Input
            placeholder="Plugin ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
            >
              <PluginCard
                plugin={p}
                toggling={togglingName === p.name}
                onSetup={() => setSetupPlugin(p)}
                onToggle={(enabled) => handleToggle(p, enabled)}
              />
            </motion.div>
          ))}
        </div>
      )}

      <SetupWizardDialog
        plugin={setupPlugin}
        open={!!setupPlugin}
        onOpenChange={(open) => !open && setSetupPlugin(null)}
      />

      <Dialog open={!!dangerousPlugin} onOpenChange={(open) => !open && setDangerousPlugin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Güvenlik uyarısı</DialogTitle>
            <DialogDescription>
              <strong>{dangerousPlugin?.name}</strong> etkinleştirildiğinde riskli araç kombinasyonları
              kullanılabilir hale gelir.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {(dangerousPlugin?.security?.dangerousCombinations ?? []).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDangerousPlugin(null)}>
              İptal
            </Button>
            <Button onClick={confirmDangerousEnable} disabled={toggleMutation.isPending}>
              Yine de etkinleştir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
