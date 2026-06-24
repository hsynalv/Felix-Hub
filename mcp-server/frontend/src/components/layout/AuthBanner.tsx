import { KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type AuthBannerProps = {
  message?: string;
};

export function AuthBanner({
  message = "Sohbet ve araçlar için API anahtarı gerekir. Ayarlar sayfasından kaydedin.",
}: AuthBannerProps) {
  return (
    <Alert variant="warning">
      <KeyRound className="h-4 w-4" />
      <AlertTitle>API anahtarı gerekli</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-2">
        <span>{message}</span>
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings">Ayarlara git</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
