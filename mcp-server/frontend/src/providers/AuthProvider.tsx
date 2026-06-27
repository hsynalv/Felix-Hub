import { useEffect, useState, type ReactNode, createContext, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  clearAuthRefreshTimer,
  ensureAuth,
  isPublicRoute,
  type AuthMode,
  type AuthUser,
  getSession,
} from "@/lib/auth";
import { hydrateProjectContext } from "@/lib/project-context";

type AuthContextValue = {
  ready: boolean;
  error: string | null;
  mode: AuthMode;
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue>({
  ready: false,
  error: null,
  mode: "open",
  user: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>("open");
  const [user, setUser] = useState<AuthUser | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const pathname = window.location.pathname;

    async function bootstrap() {
      try {
        const authMode = await ensureAuth(pathname);
        if (cancelled) return;
        setMode(authMode);

        if (authMode === "session") {
          const sessionUser = await getSession();
          setUser(sessionUser);
        } else {
          setUser(null);
        }

        if (authMode !== "login_required" && !isPublicRoute(pathname)) {
          await hydrateProjectContext();
        }

        if (!cancelled) {
          void queryClient.invalidateQueries({ queryKey: ["whoami"] });
          void queryClient.invalidateQueries({ queryKey: ["health"] });
          setReady(true);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Kimlik doğrulama başarısız");
        setMode("login_required");
        setReady(true);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      clearAuthRefreshTimer();
    };
  }, [queryClient]);

  const onPublicPage = isPublicRoute(window.location.pathname);

  if (!ready && !onPublicPage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Bağlanıyor…</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ ready, error, mode, user }}>
      {error && !onPublicPage && (
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
