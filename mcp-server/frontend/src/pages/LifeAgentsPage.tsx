import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bot, Play, Plus, ShoppingBag, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_SHELL_WIDE } from "@/components/layout/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import {
  createLifeAgentFromPreset,
  fetchLifeAgentPresets,
  fetchLifeAgents,
  searchShopping,
  testLifeAgent,
} from "@/lib/personal-api";

export function LifeAgentsPage() {
  const queryClient = useQueryClient();
  const [shopQuery, setShopQuery] = useState("");

  const presetsQ = useQuery({ queryKey: ["life-presets"], queryFn: fetchLifeAgentPresets });
  const agentsQ = useQuery({ queryKey: ["life-agents"], queryFn: fetchLifeAgents });

  const createMutation = useMutation({
    mutationFn: (presetId: string) => createLifeAgentFromPreset(presetId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["life-agents"] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => testLifeAgent(id),
  });

  const shopMutation = useMutation({
    mutationFn: () => searchShopping(shopQuery.trim()),
  });

  return (
    <div className={`${PAGE_SHELL_WIDE} space-y-6`}>
      <PageHeader
        title="Life Agents"
        description="Günlük hayat agent profilleri — mail, haber, alışveriş, hatırlatıcı."
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link to="/">← Bugün</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-4 w-4" />
              Alışveriş araştırması
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Ürün ara (ör. kablosuz kulaklık)"
              value={shopQuery}
              onChange={(e) => setShopQuery(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!shopQuery.trim() || shopMutation.isPending}
              onClick={() => shopMutation.mutate()}
            >
              Ara
            </Button>
          </div>
          {shopMutation.data && (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">{shopMutation.data.summary}</p>
              {shopMutation.data.results.map((r) => (
                <div key={r.id} className="rounded-md border p-2">
                  <p className="font-medium">{r.title}</p>
                  {r.price && <p className="text-xs text-muted-foreground">{r.price}</p>}
                  <p className="text-xs text-muted-foreground line-clamp-2">{r.snippet}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Preset katalog
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {presetsQ.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            presetsQ.data?.presets.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-2 border-b pb-2 last:border-0">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.goal}</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    {p.approvalPolicy}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={createMutation.isPending}
                  onClick={() => createMutation.mutate(p.id)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Ekle
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            Agent'larım
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {agentsQ.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : !agentsQ.data?.agents.length ? (
            <p className="text-sm text-muted-foreground">Henüz agent yok — preset'ten ekleyin.</p>
          ) : (
            agentsQ.data.agents.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.goal}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={testMutation.isPending}
                  onClick={() => testMutation.mutate(a.id)}
                >
                  <Play className="mr-1 h-3 w-3" />
                  Test
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
