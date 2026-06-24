import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Bot,
  Home,
  LayoutGrid,
  Menu,
  Moon,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getApiKey, requestUiToken, setApiKey } from "@/lib/auth";
import { apiGet, type WhoamiData } from "@/lib/api-client";
import { useTheme } from "@/providers/ThemeProvider";
import { useToast } from "@/providers/ToastProvider";

const nav = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/chat", label: "Chat", icon: Bot },
  { to: "/tools", label: "Tools", icon: Wrench },
  { to: "/plugins", label: "Plugins", icon: LayoutGrid },
  { to: "/audit", label: "Audit", icon: Shield },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
  { to: "/observability", label: "Observability", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [keyInput, setKeyInput] = useState(() => getApiKey());
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const location = useLocation();

  const { data: whoami } = useQuery({
    queryKey: ["whoami"],
    queryFn: () => apiGet<WhoamiData>("/whoami"),
    enabled: !!getApiKey(),
    retry: false,
  });

  const saveKey = () => {
    setApiKey(keyInput);
    qc.invalidateQueries();
    toast.show("API key kaydedildi");
  };

  const fetchToken = async () => {
    try {
      const { token } = await requestUiToken();
      if (token) {
        setKeyInput(token);
        setApiKey(token);
        qc.invalidateQueries();
        toast.show(`Token alındı: ${token}`, "warn");
      }
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Token alınamadı", "error");
    }
  };

  const refresh = () => qc.invalidateQueries();

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className={cn("flex flex-col gap-1", mobile && "p-4")}>
      {nav.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={() => mobile && setSidebarOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-card/50 md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
            MCP
          </div>
          <span className="font-semibold">MCP Hub</span>
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <NavItems />
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card md:hidden"
            >
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <span className="font-semibold">MCP Hub</span>
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <NavItems mobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden flex-1 text-sm text-muted-foreground md:block">{location.pathname}</div>
          <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
            {whoami?.auth?.scopes && (
              <Badge variant="success" className="hidden sm:inline-flex">
                {whoami.auth.scopes.join(", ")}
              </Badge>
            )}
            <Input
              type="password"
              placeholder="API key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="hidden w-36 sm:block md:w-44"
            />
            <Button variant="outline" size="sm" onClick={saveKey} className="hidden sm:inline-flex">
              Save
            </Button>
            <Button variant="secondary" size="sm" onClick={fetchToken} className="hidden sm:inline-flex">
              Token
            </Button>
            <Button variant="ghost" size="icon" onClick={toggle}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main
          className={cn(
            "flex flex-1 flex-col min-h-0 p-4 md:p-6",
            location.pathname === "/chat" ? "overflow-hidden" : "overflow-auto"
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={cn(location.pathname === "/chat" && "flex min-h-0 flex-1 flex-col")}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile bottom nav */}
        <nav className="flex border-t border-border bg-card/80 backdrop-blur md:hidden">
          {nav.slice(0, 5).map(({ to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <Icon className="h-5 w-5" />
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
