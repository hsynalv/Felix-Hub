import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/layout/StatusBadge";

export function OpsPageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative mx-auto max-w-6xl space-y-6 pb-8", className)}>
      <div className="pointer-events-none absolute inset-x-0 -top-6 h-48 bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,oklch(0.55_0.14_280/0.14),transparent)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

export function OpsPageHero({
  icon: Icon,
  title,
  description,
  actions,
  accent = "from-primary/20 via-accent/10 to-transparent",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
  accent?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="flex gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br shadow-lg shadow-primary/10",
            accent
          )}
        >
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

export function OpsStatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

export function OpsStatCard({
  label,
  value,
  hint,
  icon: Icon,
  status,
  delay = 0,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  status?: "healthy" | "ok" | "warning" | "degraded" | "error";
  delay?: number;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-amber-500/15 text-amber-500",
    danger: "bg-destructive/15 text-destructive",
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <div className="h-full overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className={cn("rounded-xl p-2.5", toneClass)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              {status && <StatusBadge status={status} className="text-[10px]" />}
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
            {hint && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function OpsPanel({
  title,
  description,
  actions,
  children,
  className,
  noPadding,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 px-4 py-3 sm:px-5">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={cn(!noPadding && "p-4 sm:p-5")}>{children}</div>
    </div>
  );
}

export function OpsToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/50 bg-muted/20 p-2 backdrop-blur-sm">
      {children}
    </div>
  );
}

export function OpsPill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      {children}
    </Comp>
  );
}

export function OpsCodeBlock({ children }: { children: string }) {
  return (
    <pre className="max-h-40 overflow-auto rounded-xl border border-border/50 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
      {children}
    </pre>
  );
}

export function OpsMethodBadge({ method }: { method?: string }) {
  const m = (method || "GET").toUpperCase();
  const color =
    m === "GET"
      ? "bg-emerald-500/15 text-emerald-400"
      : m === "POST"
        ? "bg-sky-500/15 text-sky-400"
        : m === "DELETE"
          ? "bg-red-500/15 text-red-400"
          : "bg-muted text-muted-foreground";

  return (
    <span className={cn("rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold", color)}>{m}</span>
  );
}
