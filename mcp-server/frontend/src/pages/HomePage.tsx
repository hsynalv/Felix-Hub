import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Bot, LayoutGrid, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiGet, type HealthData, type PluginInfo } from "@/lib/api-client";

export function HomePage() {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<HealthData>("/health"),
  });

  const { data: plugins = [] } = useQuery({
    queryKey: ["plugins"],
    queryFn: () => apiGet<PluginInfo[]>("/plugins"),
  });

  const toolCount = plugins.reduce((n, p) => n + (Array.isArray(p.tools) ? p.tools.length : 0), 0);

  const stats = [
    { label: "Health", value: health?.status ?? "—", meta: health?.auth ?? "" },
    { label: "Plugins", value: plugins.length, meta: "loaded" },
    { label: "Tools", value: toolCount, meta: "registered" },
    {
      label: "Persistence",
      value: health?.persistence?.status ?? "disabled",
      meta: health?.persistence?.enabled ? `v${health.persistence.schemaVersion ?? "?"}` : "off",
    },
  ];

  const quickLinks = [
    { to: "/chat", label: "LLM Chat", icon: Bot, desc: "Streaming sohbet + MCP tools" },
    { to: "/tools", label: "Tool Registry", icon: Wrench, desc: "163+ MCP tool keşfi" },
    { to: "/plugins", label: "Plugins", icon: LayoutGrid, desc: "35 plugin yönetimi" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <h1 className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-3xl font-bold text-transparent">
          MCP Hub
        </h1>
        <p className="text-muted-foreground">AI Operating System — plugin tabanlı agent backend</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-normal text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold capitalize">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.meta}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {quickLinks.map((link, i) => (
          <motion.div key={link.to} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.05 }}>
            <Link to={link.to}>
              <Card className="group transition-all hover:border-primary/50 hover:shadow-md hover:shadow-primary/5">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <link.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      {link.label}
                      <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="text-xs text-muted-foreground">{link.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {health?.persistence?.status === "degraded" && (
        <Badge variant="warning">Persistence degraded: {health.persistence.error}</Badge>
      )}
    </div>
  );
}
