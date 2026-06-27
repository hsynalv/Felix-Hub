import { useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Menu, X } from "lucide-react";
import { BRAND } from "@/lib/branding";
import { MARKETING_LINKS } from "@/lib/marketing-links";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Architecture", href: "#architecture" },
  { label: "Use cases", href: "#use-cases" },
  { label: "Security", href: "#security" },
] as const;

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-background/85 shadow-sm shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <span>{BRAND.hubName}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
          <a
            href={MARKETING_LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            GitHub
          </a>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <a href={MARKETING_LINKS.github} target="_blank" rel="noopener noreferrer">
              Source
            </a>
          </Button>
          <Button size="sm" asChild>
            <Link to={MARKETING_LINKS.login}>Sign in</Link>
          </Button>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-white/5 bg-background/95 backdrop-blur-xl md:hidden",
          open ? "block" : "hidden"
        )}
      >
        <nav className="flex flex-col gap-1 px-4 py-3">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <a
            href={MARKETING_LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-white/5"
          >
            GitHub
          </a>
          <Link
            to={MARKETING_LINKS.login}
            className="mt-1 rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-medium text-primary-foreground"
            onClick={() => setOpen(false)}
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
