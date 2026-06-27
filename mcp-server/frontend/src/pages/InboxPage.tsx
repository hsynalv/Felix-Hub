import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Inbox, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OpsPageHero, OpsPageShell, OpsPanel } from "@/components/ops/OpsPrimitives";
import {
  fetchInboxItems,
  fetchInboxSummary,
  markInboxRead,
  snoozeInboxItem,
  type InboxItem,
} from "@/lib/inbox-api";
import { useToast } from "@/providers/ToastProvider";

function priorityVariant(p: string) {
  if (p === "critical" || p === "high") return "destructive" as const;
  if (p === "low") return "outline" as const;
  return "default" as const;
}

function InboxRow({ item, onRead, onSnooze }: {
  item: InboxItem;
  onRead: (id: string) => void;
  onSnooze: (id: string) => void;
}) {
  return (
    <Card className={item.unread ? "border-primary/40" : ""}>
      <CardContent className="pt-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium truncate">{item.title}</span>
            <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
            <Badge variant="outline">{item.type}</Badge>
            {item.unread && <Badge>Yeni</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{item.message}</p>
          <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {item.type === "approval" && (
            <Button size="sm" variant="outline" asChild>
              <Link to="/approvals">Onayla</Link>
            </Button>
          )}
          {item.runId && (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/runs?highlight=${item.runId}`}>Run</Link>
            </Button>
          )}
          {item.unread && (
            <Button size="sm" variant="ghost" onClick={() => onRead(item.id)}>
              Okundu
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onSnooze(item.id)}>
            Ertele
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function InboxPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const summaryQ = useQuery({ queryKey: ["inbox-summary"], queryFn: fetchInboxSummary, refetchInterval: 15_000 });
  const itemsQ = useQuery({ queryKey: ["inbox-items"], queryFn: () => fetchInboxItems(), refetchInterval: 15_000 });

  const readMut = useMutation({
    mutationFn: markInboxRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox-items"] });
      qc.invalidateQueries({ queryKey: ["inbox-summary"] });
    },
  });

  const snoozeMut = useMutation({
    mutationFn: (id: string) => snoozeInboxItem(id, 60),
    onSuccess: () => {
      toast.show("1 saat ertelendi");
      qc.invalidateQueries({ queryKey: ["inbox-items"] });
    },
  });

  const items = itemsQ.data?.items ?? [];
  const unread = summaryQ.data?.unreadCount ?? 0;

  const filterBy = (types: string[]) => items.filter((i) => types.includes(i.type));

  return (
    <OpsPageShell>
      <OpsPageHero
        icon={Inbox}
        title="Agent Inbox"
        description="Onaylar, başarısız run'lar, SLA ve watcher olayları — tek yüzey"
      />

      <div className="mb-4 flex gap-2 text-sm text-muted-foreground">
        <Bell className="h-4 w-4" />
        <span>{unread} okunmamış · {itemsQ.data?.count ?? 0} toplam</span>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Tümü</TabsTrigger>
          <TabsTrigger value="approvals">Onaylar</TabsTrigger>
          <TabsTrigger value="runs">Run'lar</TabsTrigger>
          <TabsTrigger value="alerts">Uyarılar</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-2 mt-4">
          <OpsPanel title="Inbox">
            {items.map((item) => (
              <InboxRow
                key={item.id}
                item={item}
                onRead={(id) => readMut.mutate(id)}
                onSnooze={(id) => snoozeMut.mutate(id)}
              />
            ))}
            {!items.length && <p className="text-sm text-muted-foreground">Inbox boş.</p>}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-2 mt-4">
          {filterBy(["approval"]).map((item) => (
            <InboxRow key={item.id} item={item} onRead={(id) => readMut.mutate(id)} onSnooze={(id) => snoozeMut.mutate(id)} />
          ))}
        </TabsContent>

        <TabsContent value="runs" className="space-y-2 mt-4">
          {filterBy(["run_failed", "run_waiting", "run_active"]).map((item) => (
            <InboxRow key={item.id} item={item} onRead={(id) => readMut.mutate(id)} onSnooze={(id) => snoozeMut.mutate(id)} />
          ))}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-2 mt-4">
          {filterBy(["sla_violation", "watcher_alert", "watcher_fired"]).map((item) => (
            <InboxRow key={item.id} item={item} onRead={(id) => readMut.mutate(id)} onSnooze={(id) => snoozeMut.mutate(id)} />
          ))}
        </TabsContent>
      </Tabs>
    </OpsPageShell>
  );
}
