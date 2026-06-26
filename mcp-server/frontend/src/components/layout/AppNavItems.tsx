import { NavLink } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/branding";
import { APP_NAV } from "@/components/layout/app-navigation";

type AppNavItemsProps = {
  onNavigate?: () => void;
  className?: string;
  disagreementCount?: number;
};

export function AppNavItems({ onNavigate, className, disagreementCount = 0 }: AppNavItemsProps) {
  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {APP_NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
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
          <span className="flex-1">{label}</span>
          {to === "/intent-training" && disagreementCount > 0 && (
            <Badge variant="warning" className="h-5 min-w-5 justify-center px-1 text-[10px]">
              {disagreementCount}
            </Badge>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppNavBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
        Fx
      </div>
      {!compact && <span className="font-semibold">{BRAND.hubName}</span>}
    </div>
  );
}
