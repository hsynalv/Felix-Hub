import { NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  GitBranch,
  Home,
  LayoutGrid,
  Menu,
  Moon,
  MoreHorizontal,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  Wrench,
  X,
} from "lucide-react";
import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { apiGet, type HealthData, type WhoamiData } from "@/lib/api-client";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const nav = [
  { to: "/", label: "Panel", icon: Home },
  { to: "/chat", label: "Sohbet", icon: Bot },
  { to: "/runs", label: "Runs", icon: GitBranch },
  { to: "/approvals", label: "Onaylar", icon: ShieldCheck },
  { to: "/usage", label: "Kullanım", icon: BarChart3 },
  { to: "/brain", label: "Brain", icon: Brain },
  { to: "/tools", label: "Araçlar", icon: Wrench },
  { to: "/plugins", label: "Plugins", icon: LayoutGrid },
  { to: "/audit", label: "Audit", icon: Shield },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
  { to: "/observability", label: "Observability", icon: Activity },
  { to: "/settings", label: "Ayarlar", icon: Settings },
];

const ROUTE_TITLES: Record<string, string> = {
  "/": "Kontrol Paneli",
  "/chat": "Sohbet",
  "/runs": "Agent Runs",
  "/approvals": "Onay Merkezi",
  "/usage": "Kullanım",
  "/brain": "Brain",
  "/tools": "Araçlar",
  "/plugins": "Plugins",
  "/audit": "Audit",
  "/admin": "Admin",
  "/observability": "Observability",
  "/settings": "Ayarlar",
};

const mobilePrimary = nav.slice(0, 4);
const mobileMore = nav.slice(4);

function PageLoader() {
  return (
    <div className="flex h-40 items-center justify-center text-muted-foreground">
      Yükleniyor…
    </div>
  );
}

/**
 * useOutlet + key — motion.div içinde <Outlet /> route değişiminde takılabiliyor.
 * Key olarak location.pathname kullanıyoruz: route'lar arası geçişte (ör. /chat →
 * /runs) sayfa animasyonla değişir, ama aynı route içinde arama parametresi
 * değişince (?c=A → ?c=B) sayfa remount OLMAZ — bileşen kendi içinde günceller.
 */
function RoutedPage({ fullBleed }: { fullBleed: boolean }) {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        className={cn("flex min-h-0 flex-1 flex-col", fullBleed ? "h-full overflow-hidden" : "")}
      >
        <Suspense fallback={<PageLoader />}>{outlet}</Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { error: authError, ready: authReady } = useAuth();

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<HealthData>("/health"),
    staleTime: 60_000,
    retry: 1,
  });

  const { data: whoami, isError: whoamiError, isFetching: whoamiLoading } = useQuery({
    queryKey: ["whoami"],
    queryFn: () => apiGet<WhoamiData>("/whoami"),
    enabled: authReady,
    staleTime: 60_000,
    retry: 1,
  });

  const authDisabled = health?.auth === "disabled";
  const connected =
    !authError &&
    (authDisabled ? health?.status === "ok" : (whoami?.auth?.scopes?.length ?? 0) > 0);
  const connecting = !authError && !authDisabled && (whoamiLoading || (!connected && !whoamiError));

  const refresh = () => qc.invalidateQueries();
  const pageTitle = ROUTE_TITLES[location.pathname] || "MCP Hub";
  const isFullBleed = location.pathname === "/chat" || location.pathname === "/brain";

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
    <TooltipProvider>
      <div className="flex h-dvh min-h-0 overflow-hidden bg-background">
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

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {!isFullBleed && (
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h1 className="truncate text-sm font-semibold">{pageTitle}</h1>
              {whoami?.auth?.scopes && (
                <Badge variant="success" className="hidden sm:inline-flex text-[10px]">
                  {whoami.auth.scopes.join(", ")}
                </Badge>
              )}
              <Badge variant={connected ? "success" : authError || whoamiError ? "destructive" : "warning"} className="text-[10px]">
                {connected ? "Bağlı" : authError || whoamiError ? "Bağlantı hatası" : connecting ? "Bağlanıyor…" : "Bağlı değil"}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={toggle}>
                    Tema: {theme === "dark" ? "Açık mod" : "Koyu mod"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={refresh}>Verileri yenile</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/settings")}>Ayarlar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" onClick={toggle} className="hidden sm:inline-flex">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={refresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </header>
          )}

          <main
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-hidden",
              isFullBleed ? "p-0" : "overflow-auto p-4 md:p-6"
            )}
          >
            <ErrorBoundary key={location.pathname}>
              <RoutedPage fullBleed={isFullBleed} />
            </ErrorBoundary>
          </main>

          <nav className="flex border-t border-border bg-card/80 backdrop-blur md:hidden">
            {mobilePrimary.map(({ to, icon: Icon }) => (
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
            <Sheet>
              <SheetTrigger asChild>
                <button type="button" className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground">
                  <MoreHorizontal className="h-5 w-5" />
                  Daha fazla
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto max-h-[70vh]">
                <SheetHeader>
                  <SheetTitle>Menü</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-2 gap-2 py-4">
                  {mobileMore.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-3 text-sm",
                          isActive ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                        )
                      }
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </NavLink>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </nav>
        </div>
      </div>
    </TooltipProvider>
  );
}
