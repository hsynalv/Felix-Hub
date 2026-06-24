import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SecretInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-sm"
      />
      <Button type="button" variant="outline" size="icon" onClick={() => setShow((s) => !s)}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export function SettingsInfoBox({
  title,
  children,
  variant = "default",
}: {
  title?: string;
  children: ReactNode;
  variant?: "default" | "warning" | "tip";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm leading-relaxed",
        variant === "default" && "border-border bg-muted/30 text-muted-foreground",
        variant === "warning" && "border-amber-500/40 bg-amber-500/10 text-amber-100",
        variant === "tip" && "border-primary/30 bg-primary/5 text-foreground"
      )}
    >
      {title && <p className="mb-1 font-medium text-foreground">{title}</p>}
      {children}
    </div>
  );
}

export function SettingsSectionCard({
  icon: Icon,
  title,
  description,
  children,
  className,
  accent,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        accent && "border-primary/20 shadow-sm shadow-primary/5",
        className
      )}
    >
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 space-y-0.5">
            <h3 className="font-semibold leading-tight">{title}</h3>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function SettingsStepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2 text-sm text-muted-foreground">
      {steps.map((step, i) => (
        <li key={step} className="flex gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
            {i + 1}
          </span>
          <span className="pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}
