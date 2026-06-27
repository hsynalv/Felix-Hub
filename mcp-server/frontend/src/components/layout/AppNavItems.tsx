import { NavLink } from "react-router-dom";
import { Settings, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/branding";
import { APP_NAV_GROUPS, ADMIN_ONLY_NAV_PATHS } from "@/components/layout/app-navigation";

type AppNavItemsProps = {
  onNavigate?: () => void;
  className?: string;
  disagreementCount?: number;
  isAdmin?: boolean;
};

export function AppNavItems({ onNavigate, className, disagreementCount = 0, isAdmin = false }: AppNavItemsProps) {
  return (
    <nav className={cn("flex flex-col gap-5", className)}>
      {APP_NAV_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items
              .filter(({ to }) => isAdmin || !ADMIN_ONLY_NAV_PATHS.has(to))
              .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/today"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary/12 text-primary shadow-sm shadow-primary/5"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                    )}
                    <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                    <span className="flex-1 truncate">{label}</span>
                    {to === "/intent-training" && disagreementCount > 0 && (
                      <Badge variant="warning" className="h-5 min-w-5 justify-center px-1 text-[10px]">
                        {disagreementCount}
                      </Badge>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}

      <div className="border-t border-border/60 pt-3">
        <div className="flex flex-col gap-0.5">
          <NavLink
            to="/settings?tab=account"
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )
            }
          >
            <User className="h-4 w-4 shrink-0" />
            Hesabım
          </NavLink>
          <NavLink
            to="/settings"
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )
            }
          >
            <Settings className="h-4 w-4 shrink-0" />
            Ayarlar
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

export function AppNavBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-sky-500 text-xs font-bold text-white shadow-md shadow-indigo-500/25">
        Fx
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{BRAND.hubName}</p>
          <p className="truncate text-[10px] text-muted-foreground">{BRAND.assistantName}</p>
        </div>
      )}
    </div>
  );
}
