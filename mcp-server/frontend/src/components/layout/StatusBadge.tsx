import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: "healthy" | "degraded" | "error" | "disabled" | "ok" | "warning";
  label?: string;
  className?: string;
};

const variantMap: Record<StatusBadgeProps["status"], "success" | "warning" | "destructive" | "default"> = {
  healthy: "success",
  ok: "success",
  degraded: "warning",
  warning: "warning",
  error: "destructive",
  disabled: "default",
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge variant={variantMap[status]} className={cn("capitalize", className)}>
      {label ?? status}
    </Badge>
  );
}
