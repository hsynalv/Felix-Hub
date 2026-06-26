import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppShellNav } from "@/components/layout/AppShellNavContext";

type MainNavMenuButtonProps = {
  className?: string;
  showLabel?: boolean;
};

export function MainNavMenuButton({ className, showLabel = false }: MainNavMenuButtonProps) {
  const { openMainNav } = useAppShellNav();

  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? "sm" : "icon"}
      className={cn(showLabel && "gap-2 rounded-xl px-2.5", className)}
      onClick={openMainNav}
      title="Uygulama menüsü"
      aria-label="Uygulama menüsü"
    >
      <Menu className="h-5 w-5 shrink-0" />
      {showLabel && <span className="text-xs font-medium">Menü</span>}
    </Button>
  );
}
