import { useMutation, useQuery } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchIntegrationPacks,
  fetchPackDetail,
  installIntegrationPack,
  type IntegrationPack,
} from "@/lib/team-api";
import { useToast } from "@/providers/ToastProvider";

const PACK_ICONS: Record<string, string> = {
  code: "💻",
  book: "📚",
  shield: "🛡️",
  zap: "⚡",
  monitor: "🖥️",
};

export function TeamPacksPanel() {
  const toast = useToast();

  const packsQuery = useQuery({
    queryKey: ["integration-packs"],
    queryFn: fetchIntegrationPacks,
  });

  const installMutation = useMutation({
    mutationFn: installIntegrationPack,
    onSuccess: (data) => {
      toast.show(`${data.enabled}/${data.total} plugin etkinleştirildi`);
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  if (packsQuery.isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  const packs = packsQuery.data?.packs ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Entegrasyon paketleri — tek tıkla ilgili plugin&apos;leri kur ve etkinleştir.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packs.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            installing={installMutation.isPending && installMutation.variables === pack.id}
            onInstall={() => installMutation.mutate(pack.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PackCard({
  pack,
  onInstall,
  installing,
}: {
  pack: IntegrationPack;
  onInstall: () => void;
  installing: boolean;
}) {
  const detailQuery = useQuery({
    queryKey: ["pack-detail", pack.id],
    queryFn: () => fetchPackDetail(pack.id),
    staleTime: 60_000,
  });

  const readyCount = detailQuery.data?.pluginStatus?.filter((p) => p.envComplete).length ?? 0;
  const total = detailQuery.data?.pluginStatus?.length ?? pack.pluginCount;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span>{PACK_ICONS[pack.icon] || "📦"}</span>
          {pack.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground line-clamp-2">{pack.description}</p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px]">
            {pack.pluginCount} plugin
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {pack.toolCount} tool
          </Badge>
          {detailQuery.data && (
            <Badge variant="outline" className="text-[10px]">
              {readyCount}/{total} hazır
            </Badge>
          )}
        </div>
        <Button size="sm" className="w-full" disabled={installing} onClick={onInstall}>
          <Zap className="mr-1.5 h-3.5 w-3.5" />
          {installing ? "Kuruluyor…" : "Paketi kur"}
        </Button>
      </CardContent>
    </Card>
  );
}
