import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Scan, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  approveImportDraft,
  fetchImportDraft,
  fetchImportDrafts,
  rejectImportDraft,
  scanPromptArchive,
  type ImportDraftSummary,
} from "@/lib/v8-api";
import { useToast } from "@/providers/ToastProvider";

function riskVariant(risk: string): "destructive" | "warning" | "success" | "outline" {
  if (risk === "high") return "destructive";
  if (risk === "medium") return "warning";
  if (risk === "low") return "success";
  return "outline";
}

export function PromptImportSettingsPanel() {
  const toast = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const draftsQuery = useQuery({
    queryKey: ["prompt-import-drafts"],
    queryFn: fetchImportDrafts,
  });

  const detailQuery = useQuery({
    queryKey: ["prompt-import-draft", selectedId],
    queryFn: () => fetchImportDraft(selectedId!),
    enabled: !!selectedId,
  });

  const scanMutation = useMutation({
    mutationFn: () => scanPromptArchive({ provider: "Kiro", maxFiles: 10 }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["prompt-import-drafts"] });
      toast.show(`${data.count} draft tarandı`);
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => approveImportDraft(id, force),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["prompt-import-drafts"] });
      setSelectedId(null);
      toast.show(`Registry'ye eklendi: ${data.promptId}`);
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectImportDraft(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompt-import-drafts"] });
      setSelectedId(null);
      toast.show("Draft reddedildi");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const drafts = draftsQuery.data?.drafts ?? [];
  const selected = drafts.find((d) => d.id === selectedId) ?? drafts[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={scanMutation.isPending}
          onClick={() => scanMutation.mutate()}
        >
          {scanMutation.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Scan className="mr-1.5 h-3.5 w-3.5" />
          )}
          Arşivi tara (Kiro)
        </Button>
        <p className="text-xs text-muted-foreground">
          Derived draft&apos;lar — onay sonrası prompt registry&apos;ye yazılır.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">İnceleme kuyruğu</CardTitle>
          </CardHeader>
          <CardContent>
            {draftsQuery.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : drafts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Bekleyen draft yok. &quot;Arşivi tara&quot; ile Kiro örneklerini içe aktar.
              </p>
            ) : (
              <ul className="space-y-2">
                {drafts.map((d) => (
                  <DraftRow
                    key={d.id}
                    draft={d}
                    selected={selected?.id === d.id}
                    onSelect={() => setSelectedId(d.id)}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Draft önizleme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!selected ? (
              <p className="text-muted-foreground">Soldan bir draft seç.</p>
            ) : (
              <>
                <p className="font-medium">{selected.name}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={riskVariant(selected.risk)}>{selected.risk} risk</Badge>
                  <Badge variant="outline">{selected.mode}</Badge>
                  {selected.disabled && <Badge variant="destructive">disabled</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Sections: {selected.sectionKeys.join(", ")}
                </p>
                {detailQuery.data?.sections && (
                  <pre className="max-h-56 overflow-auto rounded-lg border border-border/50 bg-muted/30 p-2 text-[10px]">
                    {JSON.stringify(
                      Object.fromEntries(
                        Object.entries(detailQuery.data.sections as Record<string, string>).map(
                          ([k, v]) => [k, `${String(v).slice(0, 200)}…`]
                        )
                      ),
                      null,
                      2
                    )}
                  </pre>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    disabled={approveMutation.isPending}
                    onClick={() =>
                      approveMutation.mutate({
                        id: selected.id,
                        force: selected.risk === "high" || selected.disabled,
                      })
                    }
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Onayla → registry
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={rejectMutation.isPending}
                    onClick={() => rejectMutation.mutate(selected.id)}
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Reddet
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DraftRow({
  draft,
  selected,
  onSelect,
}: {
  draft: ImportDraftSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
        selected ? "border-primary bg-primary/10" : "border-border/60 hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{draft.name}</span>
        <Badge variant={riskVariant(draft.risk)} className="shrink-0 text-[9px]">
          {draft.risk}
        </Badge>
      </div>
      <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{draft.id}</p>
    </button>
  );
}
