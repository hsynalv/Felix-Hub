import { Link } from "react-router-dom";
import { BRAND } from "@/lib/branding";
import { LANDING_TAGLINE, MARKETING_LINKS } from "@/lib/marketing-links";

const FOOTER_LINKS = [
  { label: "GitHub", href: MARKETING_LINKS.github, external: true },
  { label: "Docs", href: MARKETING_LINKS.docs, external: true },
  { label: "LinkedIn", href: MARKETING_LINKS.linkedin, external: true },
  { label: "Sign in", href: MARKETING_LINKS.login, external: false },
  { label: "License", href: MARKETING_LINKS.license, external: true },
  { label: "Contact", href: MARKETING_LINKS.contact, external: true },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/5 bg-card/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="font-semibold">{BRAND.hubName}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {LANDING_TAGLINE}
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3">
            {FOOTER_LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </div>
        <p className="mt-10 border-t border-border/40 pt-6 text-xs text-muted-foreground">
          Open source · Self-hosted · MIT License
        </p>
      </div>
    </footer>
  );
}
