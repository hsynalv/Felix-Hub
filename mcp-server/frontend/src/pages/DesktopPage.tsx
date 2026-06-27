import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_SHELL_WIDE } from "@/components/layout/page-layout";
import { FelixDesktopPanel } from "@/components/desktop/FelixDesktopPanel";
import { FelixDesktopConnectionGuide } from "@/components/desktop/FelixDesktopConnectionGuide";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BRAND } from "@/lib/branding";
import { cn } from "@/lib/utils";

export function DesktopPage() {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className={cn(PAGE_SHELL_WIDE, "flex min-h-0 flex-1 flex-col")}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={BRAND.desktopAgentName}
          description={`${BRAND.hubName} ile Mac'iniz arasındaki bağlantıyı kurun ve yönetin.`}
          className="mb-0"
        />
        <Sheet open={guideOpen} onOpenChange={setGuideOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden">
              <BookOpen className="mr-1.5 h-4 w-4" />
              Bağlantı rehberi
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b border-border/60 px-4 py-3 text-left">
              <SheetTitle className="text-sm font-semibold">Bağlantı rehberi</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-3">
              <FelixDesktopConnectionGuide className="border-0 shadow-none" />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 lg:max-w-[min(100%,48rem)]">
          <FelixDesktopPanel
            showMobileGuideButton
            onOpenGuide={() => setGuideOpen(true)}
          />
        </div>

        <aside className="hidden w-[min(100%,22rem)] shrink-0 lg:block xl:w-[24rem]">
          <div className="sticky top-4 max-h-[calc(100dvh-8rem)] overflow-hidden">
            <FelixDesktopConnectionGuide className="max-h-[calc(100dvh-8rem)]" />
          </div>
        </aside>
      </div>
    </div>
  );
}
