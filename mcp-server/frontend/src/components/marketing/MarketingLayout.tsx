import type { ReactNode } from "react";
import { MarketingNav } from "./MarketingNav";
import { MarketingFooter } from "./MarketingFooter";

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-0 flex flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain bg-background scroll-smooth">
      {/* Ambient background — fixed to viewport while content scrolls */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, oklch(0.5 0 0 / 0.12) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 50% at 50% -30%, oklch(0.55 0.22 280 / 0.45), transparent), radial-gradient(ellipse 50% 40% at 100% 0%, oklch(0.5 0.18 260 / 0.25), transparent), radial-gradient(ellipse 40% 30% at 0% 100%, oklch(0.45 0.15 220 / 0.2), transparent)",
          }}
        />
      </div>

      <MarketingNav />
      <main className="relative z-10 flex-1 pt-16">{children}</main>
      <MarketingFooter />
    </div>
  );
}
