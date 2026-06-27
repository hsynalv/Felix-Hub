import { Link } from "react-router-dom";
import { BRAND } from "@/lib/branding";
import { MARKETING_LINKS } from "@/lib/marketing-links";

const FOOTER_LINKS = [
  { label: "GitHub", href: MARKETING_LINKS.github, external: true },
  { label: "Docs", href: MARKETING_LINKS.docs, external: true },
  { label: "LinkedIn", href: MARKETING_LINKS.linkedin, external: true },
  { label: "Login", href: MARKETING_LINKS.login, external: false },
  { label: "License", href: MARKETING_LINKS.license, external: true },
  { label: "Contact", href: MARKETING_LINKS.contact, external: true },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card/30">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold">{BRAND.hubName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Personal AI Agent OS · {BRAND.authorName}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
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
    </footer>
  );
}
