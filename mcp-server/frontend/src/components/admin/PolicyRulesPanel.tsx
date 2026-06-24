import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/layout/EmptyState";
import { OpsPanel } from "@/components/ops/OpsPrimitives";
import {
  createPolicyRule,
  deletePolicyRule,
  evaluatePolicy,
  getPolicySuggestions,
  listPolicyRules,
  type PolicyRule,
} from "@/lib/policy-api";
import { useToast } from "@/providers/ToastProvider";
import { Shield } from "lucide-react";

export function PolicyRulesPanel() {
  const qc = useQueryClient();
  const toast = useToast();
  const [toolPattern, setToolPattern] = useState("shell_*");
  const [environment, setEnvironment] = useState("production");
  const [action, setAction] = useState<PolicyRule["action"]>("block");
  const [testTool, setTestTool] = useState("shell_execute");

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["policy-rules"],
    queryFn: listPolicyRules,
  });

  const { data: suggestions } = useQuery({
    queryKey: ["policy-suggestions"],
    queryFn: getPolicySuggestions,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      createPolicyRule({
        toolPattern,
        environment,
        action,
        description: `${environment}: ${toolPattern} → ${action}`,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policy-rules"] });
      toast.show("Kural eklendi");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePolicyRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policy-rules"] }),
  });

  const testMutation = useMutation({
    mutationFn: () => evaluatePolicy({ toolName: testTool, environment }),
    onSuccess: (res) => {
      const allowed = (res as { result?: { allowed?: boolean } }).result?.allowed;
      toast.show(allowed ? "İzin verilir" : "Politika engeller", allowed ? "info" : "warn");
    },
  });

  return (
    <div className="space-y-4">
      <OpsPanel title="Yeni kural" description="Ortam + tool glob (ör. shell_*)">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Tool pattern" value={toolPattern} onChange={(e) => setToolPattern(e.target.value)} />
          <Select value={environment} onValueChange={setEnvironment}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="production">production</SelectItem>
              <SelectItem value="staging">staging</SelectItem>
              <SelectItem value="development">development</SelectItem>
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={(v) => setAction(v as PolicyRule["action"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="block">block</SelectItem>
              <SelectItem value="require_approval">require_approval</SelectItem>
              <SelectItem value="dry_run_first">dry_run_first</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
            Ekle
          </Button>
        </div>
      </OpsPanel>

      <OpsPanel title="Politika test" description="Tool + ortam önizlemesi">
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" value={testTool} onChange={(e) => setTestTool(e.target.value)} />
          <Button variant="outline" size="sm" onClick={() => testMutation.mutate()}>
            Değerlendir
          </Button>
        </div>
      </OpsPanel>

      <OpsPanel title="Aktif kurallar">
        {isLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : rules.length === 0 ? (
          <EmptyState icon={Shield} title="Kural yok" description="Preset yükleyin veya yukarıdan ekleyin." />
        ) : (
          <ul className="space-y-2">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-mono text-xs">
                  {r.toolPattern || r.pattern} · {r.environment || "*"} · {r.action}
                </span>
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(r.id)}>
                  Sil
                </Button>
              </li>
            ))}
          </ul>
        )}
      </OpsPanel>

      {(suggestions?.suggestions?.length ?? 0) > 0 && (
        <OpsPanel title="Öneriler" description="Sık reddedilen araçlar">
          <ul className="space-y-1 text-xs text-muted-foreground">
            {suggestions!.suggestions.map((s) => (
              <li key={s.tool}>
                {s.tool} — {s.rejectCount} red
              </li>
            ))}
          </ul>
        </OpsPanel>
      )}
    </div>
  );
}
