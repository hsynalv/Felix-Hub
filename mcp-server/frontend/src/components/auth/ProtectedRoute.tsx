import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

export function ProtectedRoute() {
  const { ready, mode } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Bağlanıyor…</p>
      </div>
    );
  }

  if (mode === "login_required") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
