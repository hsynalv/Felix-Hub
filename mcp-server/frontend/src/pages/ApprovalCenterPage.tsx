import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Shield, ShieldAlert, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PAGE_SHELL_WIDE } from "@/components/layout/page-layout";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  decideApproval,
  getApprovalDetail,
  listApprovalHistory,
  listPendingApprovals,
  type ApprovalDecision,
  type ApprovalDetail,
} from "@/lib/approvals-api";
import { useToast } from "@/providers/ToastProvider";
import { cn } from "@/lib/utils";

function riskBadgeVariant(score?: number | null) {
  if (score == null) return "outline" as const;
  if (score >= 70) return "destructive" as const;
  if (score >= 40) return "warning" as const;
  return "outline" as const;
}

function statusLabel(status: string) {
  if (status === "approved") return "Onaylandı";
  if (status === "rejected" || status === "denied") return "Reddedildi";
  if (status === "pending") return "Bekliyor";
  return status;
}

export function ApprovalCenterPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ["approvals-pending"],
    queryFn: listPendingApprovals,
    refetchInterval: 5000,
  });
  const { data: historyData } = useQuery({
    queryKey: ["approvals-history"],
    queryFn: () => listApprovalHistory(30),
  });
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["approval-detail", selectedId],
    queryFn: () => getApprovalDetail(selectedId!),
    enabled: !!selectedId,
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: ApprovalDecision }) => decideApproval(id, decision),
    onSuccess: () => {
      toast.show("Karar kaydedildi", "info");
      qc.invalidateQueries({ queryKey: ["approvals-pending"] });
      qc.invalidateQueries({ queryKey: ["approvals-history"] });
      qc.invalidateQueries({ queryKey: ["approval-detail", selectedId] });
      setSelectedId(null);
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const pending = pendingData?.approvals ?? [];
  const history = historyData?.approvals ?? [];
  const showMobileActions = !!selectedId && detail?.status === "pending";

  return (
    <div className={cn(PAGE_SHELL_WIDE, "space-y-6 pb-24 md:pb-6")}>
      <PageHeader
        title="Onay Merkezi"
        description="Agent'ların riskli araç çağrıları burada bekler. Önizleyip tek tıkla onaylayın veya reddedin."
        actions={
          <Badge variant={pending.length ? "warning" : "outline"} className="gap-1">
            <Clock className="h-3 w-3" />
            {pending.length} bekleyen
          </Badge>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Bekleyen onaylar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[min(52vh,520px)]">
              <div className="space-y-2 pr-2">
                {pendingLoading && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}
                {!pendingLoading && !pending.length && (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    Bekleyen onay yok — her şey yolunda.
                  </div>
                )}
                {pending.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={cn(
                      "w-full rounded-xl border p-3 text-left text-sm transition-colors hover:bg-muted/50",
                      selectedId === a.id && "border-primary bg-primary/5 ring-1 ring-primary/20"
                    )}
                    onClick={() => setSelectedId(a.id)}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <span className="font-medium leading-snug">{a.toolName || a.path || a.id}</span>
                      <Badge variant={riskBadgeVariant(a.riskScore)}>risk {a.riskScore ?? "—"}</Badge>
                    </div>
                    {a.runId && (
                      <p className="text-xs text-muted-foreground">Run: {a.runId.slice(0, 8)}…</p>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="xl:col-span-8">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Detay ve karar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedId && (
              <p className="text-sm text-muted-foreground">Soldan bir onay seçin — araç, risk ve girdi önizlemesi burada görünür.</p>
            )}
            {selectedId && detailLoading && <p className="text-sm text-muted-foreground">Detay yükleniyor…</p>}
            {detail && selectedId && (
              <ApprovalDetailPanel
                detail={detail}
                onDecide={(decision) => decideMutation.mutate({ id: selectedId, decision })}
                pending={decideMutation.isPending}
              />
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-12">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Son kararlar</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-1 text-sm">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-b border-border/60 py-2 last:border-0"
                  >
                    <span className="font-medium">{h.toolName || h.id}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={h.status === "approved" ? "default" : "destructive"}>
                        {statusLabel(h.status)}
                      </Badge>
                      <Link to="/runs" className="text-xs text-primary hover:underline">
                        Run →
                      </Link>
                    </div>
                  </div>
                ))}
                {!history.length && <p className="text-muted-foreground">Henüz geçmiş kayıt yok.</p>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {showMobileActions && detail && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-3 backdrop-blur md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="mb-2 truncate text-xs text-muted-foreground">{detail.toolName || detail.id}</p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              className="h-11"
              disabled={decideMutation.isPending}
              onClick={() => decideMutation.mutate({ id: selectedId!, decision: "approve_once" })}
            >
              Onayla
            </Button>
            <Button
              className="h-11"
              variant="secondary"
              disabled={decideMutation.isPending}
              onClick={() => decideMutation.mutate({ id: selectedId!, decision: "approve_project" })}
            >
              Her zaman
            </Button>
            <Button
              className="h-11"
              variant="destructive"
              disabled={decideMutation.isPending}
              onClick={() => decideMutation.mutate({ id: selectedId!, decision: "deny" })}
            >
              Reddet
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalDetailPanel({
  detail,
  onDecide,
  pending,
}: {
  detail: ApprovalDetail;
  onDecide: (d: ApprovalDecision) => void;
  pending: boolean;
}) {
  const score = detail.riskScore ?? detail.riskBreakdown?.score;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <Badge variant={riskBadgeVariant(score)}>Risk skoru: {score ?? "—"}</Badge>
        {detail.riskLevel && <Badge variant="outline">Seviye: {detail.riskLevel}</Badge>}
        {detail.riskBreakdown?.protectedTool && <Badge variant="destructive">Korumalı araç</Badge>}
        <Badge variant="outline">{statusLabel(detail.status)}</Badge>
      </div>

      {detail.run && (
        <p>
          İlgili run:{" "}
          <Link className="font-medium text-primary underline-offset-2 hover:underline" to="/runs">
            {detail.run.goal || detail.run.id}
          </Link>
        </p>
      )}

      <div>
        <p className="mb-2 font-medium">Araç girdisi (maskelenmiş)</p>
        <pre className="max-h-56 overflow-auto rounded-xl border bg-muted/50 p-3 text-xs leading-relaxed">
          {JSON.stringify(detail.body, null, 2)}
        </pre>
      </div>

      {detail.priorStepOutput != null && (
        <div>
          <p className="mb-2 font-medium">Önceki adım çıktısı</p>
          <pre className="max-h-40 overflow-auto rounded-xl border bg-muted/50 p-3 text-xs">
            {JSON.stringify(detail.priorStepOutput, null, 2)}
          </pre>
        </div>
      )}

      {detail.status === "pending" && (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button disabled={pending} onClick={() => onDecide("approve_once")}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Bir kez onayla
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => onDecide("approve_project")}>
            Bu projede her zaman
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => onDecide("deny")}>
            <XCircle className="mr-2 h-4 w-4" />
            Reddet
          </Button>
        </div>
      )}
    </div>
  );
}
