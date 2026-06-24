import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiGetRaw, type AuditEntry } from "@/lib/api-client";
import { formatDuration, formatTime } from "@/lib/utils";

interface RequestLog {
  timestamp?: string;
  method?: string;
  path?: string;
  status?: string | number;
}

export function AuditPage() {
  const [plugin, setPlugin] = useState("");
  const [limit, setLimit] = useState("100");

  const { data: archiveData, isLoading: archiveLoading } = useQuery({
    queryKey: ["audit-archive", plugin, limit],
    queryFn: () => {
      let path = `/audit/archive?limit=${limit}`;
      if (plugin) path += `&plugin=${encodeURIComponent(plugin)}`;
      return apiGetRaw<{ source?: string; entries?: AuditEntry[]; data?: { entries?: AuditEntry[] } }>(path);
    },
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["audit-logs", limit],
    queryFn: () =>
      apiGetRaw<{ logs?: RequestLog[]; data?: { logs?: RequestLog[] } }>(`/audit/logs?limit=${limit}`),
  });

  const entries = archiveData?.entries ?? archiveData?.data?.entries ?? [];
  const logs = logsData?.logs ?? logsData?.data?.logs ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-lg font-semibold">Audit</h1>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Plugin filter" value={plugin} onChange={(e) => setPlugin(e.target.value)} className="max-w-xs" />
        <select value={limit} onChange={(e) => setLimit(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200">200</option>
        </select>
        {archiveData?.source && <Badge>source: {archiveData.source}</Badge>}
      </div>

      <Tabs defaultValue="archive">
        <TabsList>
          <TabsTrigger value="archive">Tool Archive</TabsTrigger>
          <TabsTrigger value="requests">Request Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="archive">
          <Card className="overflow-hidden">
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="p-3">Time</th>
                    <th className="p-3">Plugin</th>
                    <th className="p-3">Operation</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {archiveLoading ? (
                    <tr><td colSpan={5} className="p-4">Yükleniyor…</td></tr>
                  ) : entries.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-muted-foreground">Kayıt yok</td></tr>
                  ) : (
                    entries.map((e, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-3 text-xs">{formatTime(e.timestamp)}</td>
                        <td className="p-3">{e.plugin}</td>
                        <td className="p-3 font-mono text-xs">{e.operation}</td>
                        <td className="p-3">
                          <Badge variant={e.success ? "success" : "destructive"}>{e.success ? "ok" : "fail"}</Badge>
                        </td>
                        <td className="p-3 text-xs">{formatDuration(e.durationMs)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card className="overflow-hidden">
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="p-3">Time</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Path</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    <tr><td colSpan={4} className="p-4">Yükleniyor…</td></tr>
                  ) : (
                    logs.map((log, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-3 text-xs">{formatTime(String(log.timestamp || ""))}</td>
                        <td className="p-3">{String(log.method || "")}</td>
                        <td className="p-3 font-mono text-xs">{String(log.path || "")}</td>
                        <td className="p-3">{String(log.status || "")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
