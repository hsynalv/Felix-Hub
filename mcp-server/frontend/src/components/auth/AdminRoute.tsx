import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type WhoamiData } from "@/lib/api-client";
import { useAuth } from "@/providers/AuthProvider";

/**
 * Admin-only app routes — SPA shell is public for refresh, but sensitive pages require admin scope.
 */
export function AdminRoute() {
  const { ready } = useAuth();

  const { data: whoami, isLoading } = useQuery({
    queryKey: ["whoami"],
    queryFn: () => apiGet<WhoamiData>("/whoami"),
    enabled: ready,
    staleTime: 60_000,
  });

  if (!ready || isLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Yetki kontrol ediliyor…</p>
      </div>
    );
  }

  const scopes = whoami?.auth?.scopes ?? [];
  if (!scopes.includes("admin")) {
    return <Navigate to="/today" replace />;
  }

  return <Outlet />;
}
