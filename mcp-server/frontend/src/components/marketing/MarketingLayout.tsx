import type { ReactNode } from "react";
import { MarketingNav } from "./MarketingNav";
import { MarketingFooter } from "./MarketingFooter";

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -20%, oklch(0.55 0.2 280 / 0.35), transparent), radial-gradient(ellipse 60% 50% at 100% 100%, oklch(0.45 0.15 260 / 0.2), transparent)",
        }}
      />
      <MarketingNav />
      <main className="relative z-10 flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
