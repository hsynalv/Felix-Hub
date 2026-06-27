import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Layers, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConversationSettings } from "@/lib/chat-instructions";
import {
  advanceSpecSession,
  createSpecSession,
  fetchSpecSession,
  isSpecChatMode,
  updateSpecArtifact,
} from "@/lib/v8-api";
import { useToast } from "@/providers/ToastProvider";

const STAGES = ["requirements", "design", "tasks"] as const;
const STAGE_LABELS: Record<(typeof STAGES)[number], string> = {
  requirements: "Requirements",
  design: "Design",
  tasks: "Tasks",
};

type SpecArtifactPanelProps = {
  settings: ConversationSettings;
  onSettingsChange: (settings: ConversationSettings) => Promise<void> | void;
  projectId?: string | null;
  disabled?: boolean;
};

export function SpecArtifactPanel({
  settings,
  onSettingsChange,
  projectId,
  disabled,
}: SpecArtifactPanelProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof STAGES)[number]>("requirements");
  const [editor, setEditor] = useState("");

  const sessionId = settings.specSessionId;
  const specActive = isSpecChatMode(settings);

  const sessionQuery = useQuery({
    queryKey: ["spec-session", sessionId],
    queryFn: () => fetchSpecSession(sessionId!),
    enabled: !!sessionId && specActive,
  });

  const session = sessionQuery.data;

  useEffect(() => {
    if (session?.artifacts?.[activeTab]?.content != null) {
      setEditor(session.artifacts[activeTab].content);
    }
  }, [session, activeTab]);

  const createMutation = useMutation({
    mutationFn: () =>
      createSpecSession({
        title: title.trim() || "Yeni özellik",
        idea: idea.trim(),
        projectId: projectId || undefined,
      }),
    onSuccess: async (data) => {
      await onSettingsChange({ ...settings, specSessionId: data.id });
      qc.invalidateQueries({ queryKey: ["spec-session", data.id] });
      toast.show("Spec oturumu oluşturuldu");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, content, stage }: { id: string; content?: string; stage?: string }) =>
      advanceSpecSession(id, content, stage),
    onSuccess: (data) => {
      qc.setQueryData(["spec-session", data.session.id], data.session);
      toast.show(`${data.savedStage} kaydedildi → ${data.nextStage}`);
      if (data.workflowDraft) {
        toast.show(`Workflow draft: ${data.workflowDraft.taskCount ?? 0} görev`);
      }
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, stage, content }: { id: string; stage: string; content: string }) =>
      updateSpecArtifact(id, stage, content),
    onSuccess: (data) => {
      qc.setQueryData(["spec-session", data.id], data);
      toast.show("Artifact güncellendi");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  if (!specActive) return null;

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Layers className="h-4 w-4 text-primary" />
          Spec workflow
        </CardTitle>
        {session && (
          <Badge variant="outline" className="text-[10px]">
            {session.stage}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!sessionId ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Spec modunda planlama artifact&apos;ları burada görünür. Önce oturum oluştur.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Başlık</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn: Push bildirimleri"
                  disabled={disabled}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Fikir / kapsam</Label>
                <Textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  rows={2}
                  placeholder="Kısa feature açıklaması…"
                  disabled={disabled}
                />
              </div>
            </div>
            <Button
              size="sm"
              disabled={disabled || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              Spec başlat
            </Button>
          </div>
        ) : sessionQuery.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Yükleniyor…
          </div>
        ) : session ? (
          <>
            <p className="text-xs font-medium">{session.title}</p>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList className="h-8 w-full">
                {STAGES.map((s) => (
                  <TabsTrigger key={s} value={s} className="flex-1 text-[10px] sm:text-xs">
                    {STAGE_LABELS[s]}
                    {session.artifacts[s] ? " ✓" : ""}
                  </TabsTrigger>
                ))}
              </TabsList>
              {STAGES.map((s) => (
                <TabsContent key={s} value={s} className="mt-2 space-y-2">
                  <Textarea
                    value={activeTab === s ? editor : session.artifacts[s]?.content || ""}
                    onChange={(e) => setEditor(e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                    disabled={disabled}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled || saveMutation.isPending}
                      onClick={() =>
                        saveMutation.mutate({ id: session.id, stage: s, content: editor })
                      }
                    >
                      Kaydet
                    </Button>
                    <Button
                      size="sm"
                      disabled={disabled || advanceMutation.isPending}
                      onClick={() =>
                        advanceMutation.mutate({
                          id: session.id,
                          content: editor,
                          stage: s,
                        })
                      }
                    >
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      {s} tamamla → sonraki
                    </Button>
                  </div>
                  {session.artifacts[s]?.content && (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border/50 bg-background/80 p-3 text-xs prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{session.artifacts[s].content}</ReactMarkdown>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
