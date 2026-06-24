import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiGetRaw } from "@/lib/api-client";
import { formatTime } from "@/lib/utils";

export function ObservabilityPage() {
  const { data: health } = useQuery({
    queryKey: ["obs-health"],
    queryFn: () => apiGetRaw<Record<string, unknown>>("/observability/health"),
  });

  const { data: metrics } = useQuery({
    queryKey: ["obs-metrics"],
    queryFn: () => apiGetRaw<Record<string, unknown>>("/observability/metrics"),
  });

  const { data: errors } = useQuery({
    queryKey: ["obs-errors"],
    queryFn: () => apiGetRaw<{ errors?: Array<Record<string, unknown>>; data?: { errors?: Array<Record<string, unknown>> } }>("/observability/errors?limit=20"),
  });

  const errorList = errors?.errors ?? errors?.data?.errors ?? [];
  const healthData = (health?.data ?? health) as Record<string, unknown>;
  const metricsData = (metrics?.data ?? metrics) as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-lg font-semibold">Observability</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Health</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">
              {JSON.stringify(healthData, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">
              {JSON.stringify(metricsData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Errors</CardTitle>
        </CardHeader>
        <CardContent>
          {!Array.isArray(errorList) || errorList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Hata yok</p>
          ) : (
            <ul className="space-y-2">
              {errorList.map((e, i) => (
                <li key={i} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">{String(e.level || "error")}</Badge>
                    <span className="text-xs text-muted-foreground">{formatTime(String(e.timestamp || ""))}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs">{String(e.message || JSON.stringify(e))}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
