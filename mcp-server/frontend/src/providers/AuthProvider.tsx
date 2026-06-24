import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { clearAuthRefreshTimer, ensureAuth } from "@/lib/auth";
import { hydrateProjectContext } from "@/lib/project-context";

type AuthContextValue = {
  ready: boolean;
  error: string | null;
};

const AuthContext = createContext<AuthContextValue>({ ready: false, error: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    ensureAuth()
      .then(() => hydrateProjectContext())
      .then(() => {
        if (cancelled) return;
        void queryClient.invalidateQueries({ queryKey: ["whoami"] });
        void queryClient.invalidateQueries({ queryKey: ["health"] });
        setReady(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Kimlik doğrulama başarısız");
        setReady(true);
      });

    return () => {
      cancelled = true;
      clearAuthRefreshTimer();
    };
  }, [queryClient]);

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Bağlanıyor…</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ ready, error }}>
      {error && (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100">
          Bağlantı kurulamadı: {error}
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
