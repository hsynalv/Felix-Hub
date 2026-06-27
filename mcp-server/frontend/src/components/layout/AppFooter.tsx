import { Link } from "react-router-dom";
import { BRAND } from "@/lib/branding";

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto shrink-0 border-t border-border/60 bg-card/30 px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-[min(100%,90rem)] flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-foreground/80">{BRAND.hubName}</span>
          <span aria-hidden>·</span>
          <span>{BRAND.assistantName} kişisel agent OS</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link to="/guide" className="hover:text-foreground">
            Rehber
          </Link>
          <Link to="/settings?tab=account" className="hover:text-foreground">
            Hesabım
          </Link>
          <Link to="/settings" className="hover:text-foreground">
            Ayarlar
          </Link>
          <a href={BRAND.productionUrl} className="hover:text-foreground" target="_blank" rel="noreferrer">
            {BRAND.authorName}
          </a>
          <span>© {year}</span>
        </div>
      </div>
    </footer>
  );
}
