import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, FlaskConical, Gauge, Sparkles, Eye, Store, Shield, MessageSquare, GitMerge, User } from "lucide-react";
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
import {
  detectConflicts,
  executeNLAdmin,
  fetchAppStoreProducts,
  fetchComplianceReport,
  fetchConflicts,
  fetchOperatingPreferences,
  forgetPreference,
  installAppProduct,
  parseNLAdmin,
  rememberPreference,
  uninstallAppProduct,
} from "@/lib/v6-c-api";
import { useToast } from "@/providers/ToastProvider";

export function V6EcosystemPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [parentId, setParentId] = useState("");
  const [watcherName, setWatcherName] = useState("");
  const [watcherTemplate, setWatcherTemplate] = useState("incident-triage");
  const [nlCommand, setNlCommand] = useState("production için L2 autonomy");
  const [conflictTopic, setConflictTopic] = useState("auth jwt");
  const [prefKey, setPrefKey] = useState("pr_review");
  const [prefValue, setPrefValue] = useState("test coverage iste");

  const rolesQ = useQuery({ queryKey: ["v6-roles"], queryFn: fetchAgentRoles });
  const skillsQ = useQuery({ queryKey: ["v6-skills"], queryFn: fetchSkills });
  const watchersQ = useQuery({ queryKey: ["v6-watchers"], queryFn: fetchWatchers });
  const sandboxQ = useQuery({ queryKey: ["v6-sandbox"], queryFn: fetchSandboxSessions });
  const trustQ = useQuery({ queryKey: ["v6-trust"], queryFn: fetchTrustScores });
  const productsQ = useQuery({ queryKey: ["v6-products"], queryFn: fetchAppStoreProducts });
  const complianceQ = useQuery({ queryKey: ["v6-compliance"], queryFn: fetchComplianceReport });
  const conflictsQ = useQuery({ queryKey: ["v6-conflicts"], queryFn: fetchConflicts });
  const prefsQ = useQuery({ queryKey: ["v6-prefs"], queryFn: fetchOperatingPreferences });

  const createParentMut = useMutation({
    mutationFn: () => createParentRun("V6 multi-agent demo parent"),
    onSuccess: (run) => {
      setParentId(run.id);
      toast.show(`Parent run: ${run.id}`);
    },
  });

  const spawnMut = useMutation({
    mutationFn: () =>
      spawnChildRun(parentId, { role: "executor", templateId: "incident-triage", dryRun: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["v6-aggregate"] });
      toast.show("Child run spawn edildi");
    },
  });

  const aggregateQ = useQuery({
    queryKey: ["v6-aggregate", parentId],
    queryFn: () => fetchParentAggregate(parentId),
    enabled: !!parentId,
  });

  const compileMut = useMutation({
    mutationFn: (skillId: string) => compileSkill(skillId, { topic: "V6 demo" }),
    onSuccess: () => toast.show("Skill derlendi"),
  });

  const runSkillMut = useMutation({
    mutationFn: (skillId: string) => runSkill(skillId, { topic: "V6 demo" }, true),
    onSuccess: () => toast.show("Skill dry-run başlatıldı"),
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
      toast.show("Watcher oluşturuldu");
    },
  });

  const testFireMut = useMutation({
    mutationFn: testFireWatcher,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["v6-watchers"] });
      toast.show("Watcher test-fire tamamlandı");
    },
  });

  const sandboxMut = useMutation({
    mutationFn: () => createSandboxSession(`Sandbox ${new Date().toLocaleTimeString()}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["v6-sandbox"] });
      toast.show("Sandbox oturumu açıldı");
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
      toast.show("Trust skorları yenilendi");
    },
  });

  const installMut = useMutation({
    mutationFn: installAppProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["v6-products"] });
      toast.show("Agent kuruldu");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const uninstallMut = useMutation({
    mutationFn: uninstallAppProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["v6-products"] }),
  });

  const nlParseMut = useMutation({
    mutationFn: () => parseNLAdmin(nlCommand),
    onSuccess: (data) => toast.show((data as { preview?: { summary?: string } }).preview?.summary || "Parse OK"),
  });

  const nlExecMut = useMutation({
    mutationFn: () => executeNLAdmin(nlCommand),
    onSuccess: () => toast.show("NL admin uygulandı"),
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const conflictMut = useMutation({
    mutationFn: () => detectConflicts(conflictTopic),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["v6-conflicts"] });
      toast.show("Conflict taraması tamam");
    },
  });

  const rememberMut = useMutation({
    mutationFn: () => rememberPreference(prefKey, prefValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["v6-prefs"] });
      toast.show("Tercih kaydedildi");
    },
  });

  return (
    <OpsPageShell>
      <OpsPageHero
        title="V6 Ekosistem"
        description="Faz A–C: skills, watchers, app store, compliance, NL admin, conflicts, operating model"
        icon={Sparkles}
      />

      <Tabs defaultValue="store" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="store">App Store</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="multi">Multi-Agent</TabsTrigger>
          <TabsTrigger value="watchers">Watchers</TabsTrigger>
          <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
          <TabsTrigger value="trust">Trust</TabsTrigger>
          <TabsTrigger value="nladmin">NL Admin</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
          <TabsTrigger value="profile">Profil</TabsTrigger>
        </TabsList>

        <TabsContent value="store">
          <OpsPanel title="Agent App Store" icon={Store}>
            <div className="grid gap-3 md:grid-cols-2">
              {(productsQ.data ?? []).map((p) => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex justify-between gap-2">
                      <span>{p.name}</span>
                      {p.installed && <Badge>kurulu</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-muted-foreground">{p.description}</p>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="outline">trust {p.trustScore}</Badge>
                      <Badge variant="outline">eval {p.evalScore}</Badge>
                      <Badge variant="outline">${p.costEstimateUsd}</Badge>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => (p.installed ? uninstallMut.mutate(p.id) : installMut.mutate(p.id))}
                    >
                      {p.installed ? "Kaldır" : "Kur"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </OpsPanel>
        </TabsContent>

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
          <OpsPanel title="Parent / Child Runs" icon={Bot}>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => createParentMut.mutate()} disabled={createParentMut.isPending}>
                Parent oluştur
              </Button>
              <Button variant="outline" onClick={() => spawnMut.mutate()} disabled={!parentId || spawnMut.isPending}>
                Child spawn
              </Button>
            </div>
            {aggregateQ.data && (
              <pre className="mt-3 text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                {JSON.stringify(aggregateQ.data, null, 2)}
              </pre>
            )}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="watchers">
          <OpsPanel title="Watchers" icon={Eye}>
            <div className="flex flex-wrap gap-2 mb-4">
              <Input placeholder="Watcher adı" value={watcherName} onChange={(e) => setWatcherName(e.target.value)} className="max-w-xs" />
              <Button onClick={() => createWatcherMut.mutate()}>Ekle</Button>
            </div>
            {(watchersQ.data ?? []).map((w) => (
              <Card key={w.id} className="mb-2">
                <CardContent className="pt-4 flex justify-between">
                  <span>{w.name}</span>
                  <Button size="sm" variant="outline" onClick={() => testFireMut.mutate(w.id)}>
                    Test
                  </Button>
                </CardContent>
              </Card>
            ))}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="sandbox">
          <OpsPanel title="Sandbox" icon={FlaskConical}>
            <Button className="mb-4" onClick={() => sandboxMut.mutate()}>
              Yeni oturum
            </Button>
            {(sandboxQ.data ?? []).map((s) => (
              <div key={s.id} className="flex justify-between border p-3 mb-2 text-sm">
                <span>{s.name}</span>
                {s.status === "active" && (
                  <Button size="sm" variant="outline" onClick={() => closeSandboxMut.mutate(s.id)}>
                    Kapat
                  </Button>
                )}
              </div>
            ))}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="trust">
          <OpsPanel title="Trust" icon={Gauge}>
            <Button className="mb-4" onClick={() => trustMut.mutate()}>
              Yeniden hesapla
            </Button>
            <div className="grid gap-2 md:grid-cols-2">
              {(trustQ.data ?? []).map((t) => (
                <Card key={`${t.entityType}:${t.entityId}`}>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{t.score}</div>
                    <p className="text-sm text-muted-foreground">
                      {t.entityType}/{t.entityId}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </OpsPanel>
        </TabsContent>

        <TabsContent value="nladmin">
          <OpsPanel title="Natural Language Admin" icon={MessageSquare}>
            <Input className="mb-2" value={nlCommand} onChange={(e) => setNlCommand(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => nlParseMut.mutate()}>
                Önizle
              </Button>
              <Button onClick={() => nlExecMut.mutate()}>Uygula (onaylı)</Button>
            </div>
          </OpsPanel>
        </TabsContent>

        <TabsContent value="compliance">
          <OpsPanel title="Compliance Pack" icon={Shield}>
            {complianceQ.data && (
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                {JSON.stringify(complianceQ.data, null, 2)}
              </pre>
            )}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="conflicts">
          <OpsPanel title="Knowledge Conflicts" icon={GitMerge}>
            <div className="flex gap-2 mb-4">
              <Input value={conflictTopic} onChange={(e) => setConflictTopic(e.target.value)} className="max-w-sm" />
              <Button onClick={() => conflictMut.mutate()}>Tara</Button>
            </div>
            {(conflictsQ.data ?? []).map((c) => (
              <Card key={(c as { id: string }).id} className="mb-2">
                <CardContent className="pt-4 text-sm">
                  <pre className="text-xs overflow-auto">{JSON.stringify(c, null, 2)}</pre>
                </CardContent>
              </Card>
            ))}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="profile">
          <OpsPanel title="Operating Model" icon={User}>
            <div className="flex flex-wrap gap-2 mb-4">
              <Input placeholder="key" value={prefKey} onChange={(e) => setPrefKey(e.target.value)} className="max-w-[140px]" />
              <Input placeholder="value" value={prefValue} onChange={(e) => setPrefValue(e.target.value)} className="max-w-xs" />
              <Button onClick={() => rememberMut.mutate()}>Hatırla</Button>
            </div>
            {(prefsQ.data ?? []).map((p) => (
              <div key={p.id} className="flex justify-between border p-2 mb-2 text-sm">
                <span>
                  <strong>{p.key}</strong>: {String(p.value)}
                  {p.pinned && " 📌"}
                </span>
                {!p.pinned && (
                  <Button size="sm" variant="ghost" onClick={() => forgetPreference(p.id).then(() => prefsQ.refetch())}>
                    Sil
                  </Button>
                )}
              </div>
            ))}
          </OpsPanel>
        </TabsContent>
      </Tabs>
    </OpsPageShell>
  );
}
