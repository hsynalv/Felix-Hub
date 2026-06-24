import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiGet, type PluginInfo } from "@/lib/api-client";

interface ToolRow {
  name: string;
  description?: string;
  plugin?: string;
  tags?: string[];
  inputSchema?: Record<string, unknown>;
}

export function ToolsPage() {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [selected, setSelected] = useState<ToolRow | null>(null);

  const { data: plugins = [], isLoading } = useQuery({
    queryKey: ["plugins"],
    queryFn: () => apiGet<PluginInfo[]>("/plugins"),
  });

  const tools = useMemo(() => {
    const rows: ToolRow[] = [];
    for (const p of plugins) {
      for (const t of (p.tools || []) as ToolRow[]) {
        rows.push({ ...t, plugin: p.name });
      }
    }
    return rows;
  }, [plugins]);

  const filtered = tools.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.plugin?.toLowerCase().includes(q);
    const matchTag = !tag || t.tags?.includes(tag);
    return matchSearch && matchTag;
  });

  const tags = useMemo(() => {
    const set = new Set<string>();
    tools.forEach((t) => t.tags?.forEach((x) => set.add(x)));
    return [...set].sort();
  }, [tools]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-lg font-semibold">Tool Registry</h1>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Ara…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Tüm tagler</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="self-center text-sm text-muted-foreground">{filtered.length} / {tools.length}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="p-3">Tool</th>
                  <th className="p-3 hidden sm:table-cell">Plugin</th>
                  <th className="p-3 hidden md:table-cell">Tags</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-muted-foreground">
                      Yükleniyor…
                    </td>
                  </tr>
                ) : (
                  filtered.slice(0, 200).map((t, i) => (
                    <motion.tr
                      key={t.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.01, 0.5) }}
                      onClick={() => setSelected(t)}
                      className="cursor-pointer border-t border-border hover:bg-muted/50"
                    >
                      <td className="p-3">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>
                      </td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">{t.plugin}</td>
                      <td className="p-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {t.tags?.slice(0, 3).map((x) => (
                            <Badge key={x}>{x}</Badge>
                          ))}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detay</CardTitle>
          </CardHeader>
          <CardContent>
            {selected ? (
              <div className="space-y-2 text-sm">
                <p className="font-mono font-medium">{selected.name}</p>
                <p className="text-muted-foreground">{selected.description}</p>
                <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-2 text-xs">
                  {JSON.stringify(selected.inputSchema ?? {}, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Tool seçin</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
