/**
 * Session cookie auth + legacy API key fallback (localhost dev).
 */

const STORAGE_KEY = "mcpHubApiKey";
const EXPIRES_KEY = "mcpHubApiKeyExpires";

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let authInFlight: Promise<AuthMode> | null = null;

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  namespace: string;
};

export type AuthMode = "open" | "session" | "key" | "login_required";

const AUTH_PATHS = new Set(["/login", "/register"]);

export function isAuthRoute(pathname: string) {
  return AUTH_PATHS.has(pathname);
}

export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function setApiKey(key: string): void {
  if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
  else localStorage.removeItem(STORAGE_KEY);
}

function parseExpiresMs(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const asNumber = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(asNumber) && asNumber > 1_000_000_000_000) return asNumber;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function storeToken(token: string, expiresAt?: string | number) {
  setApiKey(token);
  if (expiresAt != null) sessionStorage.setItem(EXPIRES_KEY, String(expiresAt));
  else sessionStorage.removeItem(EXPIRES_KEY);
}

function unwrapApiData<T>(json: unknown): T {
  if (json && typeof json === "object" && "ok" in json && (json as { ok: boolean }).ok === true && "data" in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

async function parseJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(res.ok ? "Sunucu boş yanıt döndü" : `Sunucu hatası (${res.status})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Geçersiz sunucu yanıtı (${res.status})`);
  }
}

const fetchOpts: RequestInit = { credentials: "include" };

export async function getSession(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/auth/me", { ...fetchOpts, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = await res.json();
    const data = unwrapApiData<{ user?: AuthUser }>(json);
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch("/auth/login", {
    method: "POST",
    ...fetchOpts,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error((json as { error?: { message?: string } })?.error?.message || "Giriş başarısız");
  }
  const data = unwrapApiData<{ user: AuthUser }>(json);
  return data.user;
}

export async function register(
  email: string,
  password: string,
  displayName?: string
): Promise<AuthUser> {
  const res = await fetch("/auth/register", {
    method: "POST",
    ...fetchOpts,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  });
  const json = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error((json as { error?: { message?: string } })?.error?.message || "Kayıt başarısız");
  }
  const data = unwrapApiData<{ user: AuthUser }>(json);
  return data.user;
}

export async function logout(): Promise<void> {
  await fetch("/auth/logout", { method: "POST", ...fetchOpts });
  setApiKey("");
  sessionStorage.removeItem(EXPIRES_KEY);
  if (refreshTimer) clearTimeout(refreshTimer);
}

export async function refreshSession(): Promise<boolean> {
  const res = await fetch("/auth/refresh", { method: "POST", ...fetchOpts });
  return res.ok;
}

export async function requestUiToken(options?: { silent?: boolean }): Promise<{
  token: string;
  expiresAt?: string;
  ttlMs?: number;
}> {
  const res = await fetch("/ui/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ silent: options?.silent ?? true }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Token failed (${res.status})`);
  }
  const data = unwrapApiData<{ token: string; expiresAt?: string | number; ttlMs?: number }>(json);
  return {
    token: String(data.token || ""),
    expiresAt: data.expiresAt != null ? String(data.expiresAt) : undefined,
    ttlMs: data.ttlMs,
  };
}

async function isAuthRequired(): Promise<boolean> {
  try {
    const res = await fetch("/health", { headers: { Accept: "application/json" } });
    if (!res.ok) return false;
    const json = await res.json();
    const data = unwrapApiData<{ auth?: string }>(json);
    return data.auth === "enabled";
  } catch {
    return false;
  }
}

async function validateCurrentKey(): Promise<boolean> {
  const key = getApiKey();
  if (!key) return false;

  const expires = sessionStorage.getItem(EXPIRES_KEY);
  const expMs = parseExpiresMs(expires);
  if (expMs != null && expMs <= Date.now() + 30_000) {
    return false;
  }

  try {
    const res = await fetch("/whoami", {
      credentials: "include",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!res.ok) return false;
    const json = await res.json();
    const data = unwrapApiData<{ auth?: { scopes?: string[] } }>(json);
    return (data.auth?.scopes?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

function scheduleSessionRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    void refreshSession().then((ok) => {
      if (ok) scheduleSessionRefresh();
    });
  }, 6 * 60 * 60 * 1000);
}

function isLocalhost(): boolean {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

async function runEnsureAuth(pathname: string): Promise<AuthMode> {
  const authRequired = await isAuthRequired();
  if (!authRequired) {
    setApiKey("");
    sessionStorage.removeItem(EXPIRES_KEY);
    return "open";
  }

  if (isAuthRoute(pathname)) {
    return "login_required";
  }

  const sessionUser = await getSession();
  if (sessionUser) {
    scheduleSessionRefresh();
    return "session";
  }

  if (await validateCurrentKey()) {
    return "key";
  }

  if (isLocalhost()) {
    try {
      const { token, expiresAt } = await requestUiToken({ silent: true });
      if (token) {
        storeToken(token, expiresAt);
        return "key";
      }
    } catch {
      /* user auth required */
    }
  }

  return "login_required";
}

export async function ensureAuth(pathname = window.location.pathname): Promise<AuthMode> {
  if (authInFlight) return authInFlight;
  authInFlight = runEnsureAuth(pathname).finally(() => {
    authInFlight = null;
  });
  return authInFlight;
}

export function clearAuthRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}
