import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield } from "lucide-react";
import { OpsPageHero, OpsPageShell, OpsPanel } from "@/components/ops/OpsPrimitives";
import {
  decideApproval,
  getApprovalDetail,
  listApprovalHistory,
  listPendingApprovals,
  type ApprovalDecision,
  type ApprovalDetail,
} from "@/lib/approvals-api";
import { useToast } from "@/providers/ToastProvider";

export function ApprovalCenterPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: pendingData } = useQuery({ queryKey: ["approvals-pending"], queryFn: listPendingApprovals, refetchInterval: 5000 });
  const { data: historyData } = useQuery({ queryKey: ["approvals-history"], queryFn: () => listApprovalHistory(30) });
  const { data: detail } = useQuery({
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
    <OpsPageShell className="pb-24 md:pb-0">
      <OpsPageHero icon={Shield} title="Approval Center" description="Risk skoru, masked preview ve birleşik onay kararı" />
      <div className="mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin">Admin</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2">
        <OpsPanel title={`Bekleyen (${pending.length})`}>
          <ScrollArea className="h-64 md:h-72">
            <div className="space-y-2 pr-2">
              {pending.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`w-full rounded-md border p-3 text-left text-sm active:bg-muted ${selectedId === a.id ? "border-primary bg-muted" : ""}`}
                  onClick={() => setSelectedId(a.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{a.toolName || a.path || a.id}</span>
                    <Badge variant="outline">risk {a.riskScore ?? "—"}</Badge>
                  </div>
                  {a.runId && <div className="text-xs text-muted-foreground">run: {a.runId.slice(0, 8)}…</div>}
                </button>
              ))}
              {!pending.length && <p className="text-sm text-muted-foreground">Bekleyen onay yok</p>}
            </div>
          </ScrollArea>
        </OpsPanel>

        <OpsPanel title="Detay" className="hidden md:block">
          {detail ? (
            <ApprovalDetailPanel
              detail={detail}
              onDecide={(decision) => selectedId && decideMutation.mutate({ id: selectedId, decision })}
              pending={decideMutation.isPending}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Soldan bir onay seçin</p>
          )}
        </OpsPanel>

        {selectedId && detail && (
          <OpsPanel title="Detay" className="md:hidden">
            <ApprovalDetailPanel
              detail={detail}
              onDecide={(decision) => decideMutation.mutate({ id: selectedId, decision })}
              pending={decideMutation.isPending}
              compact
            />
          </OpsPanel>
        )}

        <OpsPanel title="Geçmiş" className="lg:col-span-2">
          <ScrollArea className="h-40">
            <div className="space-y-1 text-sm">
              {history.map((h) => (
                <div key={h.id} className="flex justify-between border-b py-1">
                  <span>{h.toolName || h.id}</span>
                  <Badge variant={h.status === "approved" ? "default" : "destructive"}>{h.status}</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </OpsPanel>
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
    </OpsPageShell>
  );
}

function ApprovalDetailPanel({
  detail,
  onDecide,
  pending,
  compact = false,
}: {
  detail: ApprovalDetail;
  onDecide: (d: ApprovalDecision) => void;
  pending: boolean;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <Badge>Skor: {detail.riskScore ?? detail.riskBreakdown?.score ?? "—"}</Badge>
        {detail.riskLevel && <Badge variant="outline">{detail.riskLevel}</Badge>}
        {detail.riskBreakdown?.protectedTool && <Badge variant="destructive">Korumalı tool</Badge>}
      </div>
      {detail.run && (
        <p>
          Run: <Link className="underline" to={`/runs`}>{detail.run.goal || detail.run.id}</Link>
        </p>
      )}
      <div>
        <div className="mb-1 font-medium">Input (masked)</div>
        <pre className={`overflow-auto rounded bg-muted p-2 text-xs ${compact ? "max-h-24" : "max-h-32"}`}>
          {JSON.stringify(detail.body, null, 2)}
        </pre>
      </div>
      {detail.priorStepOutput != null && (
        <div>
          <div className="mb-1 font-medium">Önceki step output</div>
          <pre className="max-h-24 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(detail.priorStepOutput, null, 2)}</pre>
        </div>
      )}
      {detail.status === "pending" && !compact && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => onDecide("approve_once")}>
            Bir kez onayla
          </Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => onDecide("approve_project")}>
            Projede her zaman
          </Button>
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => onDecide("deny")}>
            Reddet
          </Button>
        </div>
      )}
    </div>
  );
}
