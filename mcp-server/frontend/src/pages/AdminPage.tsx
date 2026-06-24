import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiGet, apiGetRaw, type PluginInfo } from "@/lib/api-client";
import { formatTime } from "@/lib/utils";

interface JobRow {
  id?: string;
  type?: string;
  state?: string;
  createdAt?: string;
}

interface ApprovalRow {
  id?: string;
  toolName?: string;
  path?: string;
}

export function AdminPage() {
  const { data: plugins = [] } = useQuery({
    queryKey: ["plugins"],
    queryFn: () => apiGet<PluginInfo[]>("/plugins"),
  });

  const { data: jobsData } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => apiGetRaw<{ jobs?: JobRow[]; data?: { jobs?: JobRow[] } }>("/jobs?limit=20"),
  });

  const { data: jobStats } = useQuery({
    queryKey: ["jobs-stats"],
    queryFn: () => apiGetRaw<{ stats?: Record<string, number>; data?: { stats?: Record<string, number> } }>("/jobs/stats"),
  });

  const { data: approvalsData } = useQuery({
    queryKey: ["approvals-pending"],
    queryFn: () =>
      apiGetRaw<{ data?: { approvals?: ApprovalRow[] }; approvals?: ApprovalRow[] }>("/approvals/pending"),
  });

  const jobs = jobsData?.jobs ?? jobsData?.data?.jobs ?? [];
  const approvals = approvalsData?.data?.approvals ?? approvalsData?.approvals ?? [];
  const stats = jobStats?.stats ?? jobStats?.data?.stats ?? {};

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-lg font-semibold">Admin</h1>

      <div className="grid gap-4 sm:grid-cols-4">
        {Object.entries(stats).map(([k, v]) => (
          <Card key={k}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-normal capitalize text-muted-foreground">{k}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="approvals">
        <TabsList>
          <TabsTrigger value="approvals">Policy Queue ({approvals.length})</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="plugins">Plugins</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals">
          <Card>
            <CardContent className="p-4">
              {approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bekleyen onay yok</p>
              ) : (
                <ul className="space-y-2">
                  {approvals.map((a, i) => (
                    <li key={i} className="rounded-lg border border-border p-3 text-sm">
                      <div className="font-mono">{String(a.id || a.toolName || "—")}</div>
                      <div className="text-xs text-muted-foreground">{String(a.path || a.toolName || "")}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs">
          <Card className="overflow-hidden">
            <div className="max-h-[50vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/80">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="p-3">ID</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">State</th>
                    <th className="p-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-3 font-mono text-xs">{String(j.id || "").slice(0, 12)}</td>
                      <td className="p-3">{String(j.type || "")}</td>
                      <td className="p-3">
                        <Badge>{String(j.state || "")}</Badge>
                      </td>
                      <td className="p-3 text-xs">{formatTime(String(j.createdAt || ""))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="plugins">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {plugins.map((p) => (
              <Card key={p.name}>
                <CardContent className="p-3 text-sm">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{Array.isArray(p.tools) ? p.tools.length : 0} tools</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
