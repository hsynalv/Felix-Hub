import type { ReactNode } from "react";
import { Bot } from "lucide-react";
import { BRAND, hubTagline } from "@/lib/branding";

export function AuthLayout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -20%, oklch(0.55 0.2 280 / 0.35), transparent), radial-gradient(ellipse 60% 50% at 100% 100%, oklch(0.45 0.15 260 / 0.2), transparent)",
        }}
      />
      <div className="relative z-10 mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
          <Bot className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{BRAND.assistantName}</h1>
          <p className="text-sm text-muted-foreground">{hubTagline()}</p>
        </div>
      </div>
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur sm:p-8">
        <div className="mb-6 text-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
