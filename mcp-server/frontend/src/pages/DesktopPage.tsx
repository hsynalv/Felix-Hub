import { useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_SHELL_WIDE } from "@/components/layout/page-layout";
import { FelixDesktopPanel } from "@/components/desktop/FelixDesktopPanel";
import { FelixDesktopPairingModal } from "@/components/desktop/FelixDesktopPairingModal";
import { BRAND } from "@/lib/branding";
import { cn } from "@/lib/utils";

export function DesktopPage() {
  const [pairingOpen, setPairingOpen] = useState(false);
  const [pairingView, setPairingView] = useState<"pair" | "help">("pair");

  const openPairing = (view: "pair" | "help" = "pair") => {
    setPairingView(view);
    setPairingOpen(true);
  };

  return (
    <div className={cn(PAGE_SHELL_WIDE, "flex min-h-0 flex-1 flex-col")}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={BRAND.desktopAgentName}
          description={`${BRAND.hubName} ile Mac'iniz arasındaki bağlantıyı yönetin.`}
          className="mb-0"
        />
        <Button size="sm" onClick={() => openPairing("pair")}>
          <Link2 className="mr-1.5 h-4 w-4" />
          Yeni eşleşme
        </Button>
      </div>

      <FelixDesktopPanel onOpenPairing={openPairing} />

      <FelixDesktopPairingModal
        open={pairingOpen}
        onOpenChange={setPairingOpen}
        initialView={pairingView}
      />
    </div>
  );
}
