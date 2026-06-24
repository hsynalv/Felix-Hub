const STORAGE_KEY = "mcpHubApiKey";
const EXPIRES_KEY = "mcpHubApiKeyExpires";

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let authInFlight: Promise<void> | null = null;

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

/** Uses /health — /whoami requires auth and must not be used here. */
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

function scheduleRefresh(expiresAt?: string, ttlMs?: number) {
  if (refreshTimer) clearTimeout(refreshTimer);

  let delay = 23 * 60 * 60 * 1000;
  const expMs = parseExpiresMs(expiresAt ?? null);
  if (expMs != null) {
    delay = Math.max(60_000, expMs - Date.now() - 5 * 60_000);
  } else if (ttlMs) {
    delay = Math.max(60_000, ttlMs - 5 * 60_000);
  }

  refreshTimer = setTimeout(() => {
    void ensureAuth(true);
  }, delay);
}

async function runEnsureAuth(forceRefresh = false): Promise<void> {
  const authRequired = await isAuthRequired();
  if (!authRequired) {
    setApiKey("");
    sessionStorage.removeItem(EXPIRES_KEY);
    if (refreshTimer) clearTimeout(refreshTimer);
    return;
  }

  if (!forceRefresh && (await validateCurrentKey())) {
    const expires = sessionStorage.getItem(EXPIRES_KEY);
    scheduleRefresh(expires ?? undefined);
    return;
  }

  const { token, expiresAt, ttlMs } = await requestUiToken({ silent: true });
  if (!token) throw new Error("Oturum token alınamadı");
  storeToken(token, expiresAt);
  scheduleRefresh(expiresAt, ttlMs);
}

/** Acquire or refresh localhost UI session token (admin scope). No-op when auth is disabled. */
export async function ensureAuth(forceRefresh = false): Promise<void> {
  if (authInFlight && !forceRefresh) return authInFlight;

  authInFlight = runEnsureAuth(forceRefresh).finally(() => {
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
