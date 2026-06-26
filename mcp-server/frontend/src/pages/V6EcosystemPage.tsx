import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, FlaskConical, Gauge, Sparkles, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OpsPageHero, OpsPageShell, OpsPanel } from "@/components/ops/OpsPrimitives";
import {
  compileSkill,
  createParentRun,
  createSandboxSession,
  createWatcher,
  fetchAgentRoles,
  fetchParentAggregate,
  fetchSandboxSessions,
  fetchSkills,
  fetchTrustScores,
  fetchWatchers,
  recalculateTrustScores,
  runSkill,
  spawnChildRun,
  testFireWatcher,
  closeSandboxSession,
} from "@/lib/v6-api";
import { useToast } from "@/providers/ToastProvider";

export function V6EcosystemPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [parentId, setParentId] = useState("");
  const [watcherName, setWatcherName] = useState("");
  const [watcherTemplate, setWatcherTemplate] = useState("incident-triage");

  const rolesQ = useQuery({ queryKey: ["v6-roles"], queryFn: fetchAgentRoles });
  const skillsQ = useQuery({ queryKey: ["v6-skills"], queryFn: fetchSkills });
  const watchersQ = useQuery({ queryKey: ["v6-watchers"], queryFn: fetchWatchers });
  const sandboxQ = useQuery({ queryKey: ["v6-sandbox"], queryFn: fetchSandboxSessions });
  const trustQ = useQuery({ queryKey: ["v6-trust"], queryFn: fetchTrustScores });

  const createParentMut = useMutation({
    mutationFn: () => createParentRun("V6 multi-agent demo parent"),
    onSuccess: (run) => {
      setParentId(run.id);
      toast({ title: "Parent run oluşturuldu", description: run.id });
    },
  });

  const spawnMut = useMutation({
    mutationFn: () =>
      spawnChildRun(parentId, { role: "executor", templateId: "incident-triage", dryRun: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["v6-aggregate"] });
      toast({ title: "Child run spawn edildi" });
    },
  });

  const aggregateQ = useQuery({
    queryKey: ["v6-aggregate", parentId],
    queryFn: () => fetchParentAggregate(parentId),
    enabled: !!parentId,
  });

  const compileMut = useMutation({
    mutationFn: (skillId: string) => compileSkill(skillId, { topic: "V6 demo" }),
    onSuccess: () => toast({ title: "Skill derlendi" }),
  });

  const runSkillMut = useMutation({
    mutationFn: (skillId: string) => runSkill(skillId, { topic: "V6 demo" }, true),
    onSuccess: () => toast({ title: "Skill dry-run başlatıldı" }),
  });

  const createWatcherMut = useMutation({
    mutationFn: () =>
      createWatcher({
        name: watcherName || "Demo watcher",
        templateId: watcherTemplate,
        source: "generic",
        dryRun: true,
        minTrustScore: 0,
      }),
    onSuccess: () => {
      setWatcherName("");
      queryClient.invalidateQueries({ queryKey: ["v6-watchers"] });
      toast({ title: "Watcher oluşturuldu" });
    },
  });

  const testFireMut = useMutation({
    mutationFn: testFireWatcher,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["v6-watchers"] });
      toast({ title: "Watcher test-fire tamamlandı" });
    },
  });

  const sandboxMut = useMutation({
    mutationFn: () => createSandboxSession(`Sandbox ${new Date().toLocaleTimeString()}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["v6-sandbox"] });
      toast({ title: "Sandbox oturumu açıldı" });
    },
  });

  const closeSandboxMut = useMutation({
    mutationFn: closeSandboxSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["v6-sandbox"] }),
  });

  const trustMut = useMutation({
    mutationFn: recalculateTrustScores,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["v6-trust"] });
      toast({ title: "Trust skorları yenilendi" });
    },
  });

  return (
    <OpsPageShell>
      <OpsPageHero
        title="V6 Ekosistem"
        description="Multi-agent, skill store, watchers, sandbox ve trust score — Faz A MVP"
        icon={Sparkles}
      />

      <Tabs defaultValue="skills" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="multi">Multi-Agent</TabsTrigger>
          <TabsTrigger value="watchers">Watchers</TabsTrigger>
          <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
          <TabsTrigger value="trust">Trust</TabsTrigger>
        </TabsList>

        <TabsContent value="skills">
          <OpsPanel title="Agent Skill Store" icon={Bot}>
            {skillsQ.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {(skillsQ.data ?? []).map((skill) => (
                  <Card key={skill.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{skill.name}</CardTitle>
                        {skill.builtin && <Badge variant="outline">builtin</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p>{skill.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {skill.tags.map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" onClick={() => compileMut.mutate(skill.id)}>
                          Derle
                        </Button>
                        <Button size="sm" onClick={() => runSkillMut.mutate(skill.id)}>
                          Dry-run
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="multi" className="space-y-4">
          <OpsPanel title="Roller" icon={Bot}>
            <div className="grid gap-2 md:grid-cols-2">
              {(rolesQ.data ?? []).map((role) => (
                <div key={role.id} className="rounded-md border p-3 text-sm">
                  <div className="font-medium">{role.label}</div>
                  <p className="text-muted-foreground">{role.description}</p>
                  <p className="text-xs mt-1">Max autonomy: {role.maxAutonomy}</p>
                </div>
              ))}
            </div>
          </OpsPanel>
          <OpsPanel title="Parent / Child Runs" icon={Bot}>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => createParentMut.mutate()} disabled={createParentMut.isPending}>
                Parent oluştur
              </Button>
              <Button
                variant="outline"
                onClick={() => spawnMut.mutate()}
                disabled={!parentId || spawnMut.isPending}
              >
                Child spawn (incident-triage)
              </Button>
            </div>
            {parentId && (
              <p className="text-sm text-muted-foreground mt-2">
                Parent ID: <code>{parentId}</code>
              </p>
            )}
            {aggregateQ.data && (
              <pre className="mt-3 text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                {JSON.stringify(aggregateQ.data, null, 2)}
              </pre>
            )}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="watchers">
          <OpsPanel title="Autonomous Watchers" icon={Eye}>
            <div className="flex flex-wrap gap-2 mb-4">
              <Input
                placeholder="Watcher adı"
                value={watcherName}
                onChange={(e) => setWatcherName(e.target.value)}
                className="max-w-xs"
              />
              <Input
                placeholder="templateId"
                value={watcherTemplate}
                onChange={(e) => setWatcherTemplate(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={() => createWatcherMut.mutate()} disabled={createWatcherMut.isPending}>
                Watcher ekle
              </Button>
            </div>
            <div className="grid gap-3">
              {(watchersQ.data ?? []).map((w) => (
                <Card key={w.id}>
                  <CardContent className="pt-4 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{w.name}</div>
                      <p className="text-sm text-muted-foreground">
                        {w.source} · {w.templateId || w.skillId} · {w.enabled ? "enabled" : "disabled"}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => testFireMut.mutate(w.id)}>
                      Test fire
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </OpsPanel>
        </TabsContent>

        <TabsContent value="sandbox">
          <OpsPanel title="Simulation Lab" icon={FlaskConical}>
            <Button className="mb-4" onClick={() => sandboxMut.mutate()} disabled={sandboxMut.isPending}>
              Yeni sandbox oturumu
            </Button>
            <div className="grid gap-2">
              {(sandboxQ.data ?? []).map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded border p-3 text-sm">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-muted-foreground">
                      {s.status} · {s.calls.length} mock call
                    </div>
                  </div>
                  {s.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => closeSandboxMut.mutate(s.id)}>
                      Kapat
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </OpsPanel>
        </TabsContent>

        <TabsContent value="trust">
          <OpsPanel title="Agent Trust Score" icon={Gauge}>
            <Button className="mb-4" onClick={() => trustMut.mutate()} disabled={trustMut.isPending}>
              Skorları yeniden hesapla
            </Button>
            <div className="grid gap-2 md:grid-cols-2">
              {(trustQ.data ?? []).map((t) => (
                <Card key={`${t.entityType}:${t.entityId}`}>
                  <CardContent className="pt-4 text-sm">
                    <div className="font-medium">
                      {t.entityType}/{t.entityId}
                    </div>
                    <div className="text-2xl font-bold">{t.score}</div>
                    <p className="text-muted-foreground">
                      {t.totalRuns} run · {Math.round((t.successRate || 0) * 100)}% success
                    </p>
                  </CardContent>
                </Card>
              ))}
              {!trustQ.data?.length && (
                <p className="text-sm text-muted-foreground">Henüz hesaplanmış skor yok — yeniden hesapla.</p>
              )}
            </div>
          </OpsPanel>
        </TabsContent>
      </Tabs>
    </OpsPageShell>
  );
}
