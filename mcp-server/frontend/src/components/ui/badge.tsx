import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "success" | "warning" | "destructive" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variant === "default" && "bg-muted text-muted-foreground",
        variant === "success" && "bg-success/20 text-success",
        variant === "warning" && "bg-amber-500/20 text-amber-300",
        variant === "destructive" && "bg-destructive/20 text-red-300",
        className
      )}
      {...props}
    />
  );
}
