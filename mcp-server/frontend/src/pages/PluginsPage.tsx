import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { apiGet, type PluginInfo } from "@/lib/api-client";

export function PluginsPage() {
  const [search, setSearch] = useState("");

  const { data: plugins = [], isLoading } = useQuery({
    queryKey: ["plugins"],
    queryFn: () => apiGet<PluginInfo[]>("/plugins"),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return plugins.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [plugins, search]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title="Plugins"
        description={`${plugins.length} yüklü plugin`}
        actions={
          <Input
            placeholder="Plugin ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => {
            const toolCount = Array.isArray(p.tools) ? p.tools.length : 0;
            return (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
              >
                <Link to={`/tools?plugin=${encodeURIComponent(p.name)}`}>
                  <Card className="h-full transition-colors hover:border-primary/30">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{p.name}</CardTitle>
                        <div className="flex gap-1">
                          {p.version && <Badge>v{p.version}</Badge>}
                          <StatusBadge status={toolCount > 0 ? "ok" : "disabled"} label={toolCount > 0 ? "active" : "idle"} />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p className="text-muted-foreground line-clamp-2">{p.description || "—"}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{toolCount} tools</span>
                        <span>{Array.isArray(p.endpoints) ? p.endpoints.length : 0} endpoints</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
