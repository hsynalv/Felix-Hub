const STORAGE_KEY = "mcpHubApiKey";

export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function setApiKey(key: string): void {
  if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
  else localStorage.removeItem(STORAGE_KEY);
}

export async function requestUiToken(): Promise<{ token: string; expiresAt?: string }> {
  const res = await fetch("/ui/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: "{}",
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Token failed (${res.status})`);
  }
  const data = json.data ?? json;
  return { token: String(data.token || ""), expiresAt: data.expiresAt };
}
