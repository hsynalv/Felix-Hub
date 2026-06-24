import { getApiKey } from "./auth";
import { getProjectHeaders } from "./workspace-context-store";

export class ApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function authHeaders(extra: HeadersInit = {}): HeadersInit {
  const key = getApiKey();
  return {
    ...getProjectHeaders(),
    Accept: "application/json",
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
    ...extra,
  };
}

function unwrap<T>(json: unknown): T {
  if (json && typeof json === "object" && "ok" in json && (json as { ok: boolean }).ok === true && "data" in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: authHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (json as { error?: { message?: string } })?.error?.message || res.statusText,
      (json as { error?: { code?: string } })?.error?.code,
      res.status
    );
  }
  return unwrap<T>(json);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (json as { error?: { message?: string } })?.error?.message || res.statusText,
      (json as { error?: { code?: string } })?.error?.code,
      res.status
    );
  }
  return unwrap<T>(json);
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (json as { error?: { message?: string } })?.error?.message || res.statusText,
      (json as { error?: { code?: string } })?.error?.code,
      res.status
    );
  }
  return unwrap<T>(json);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (json as { error?: { message?: string } })?.error?.message || res.statusText,
      (json as { error?: { code?: string } })?.error?.code,
      res.status
    );
  }
  return unwrap<T>(json);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (json as { error?: { message?: string } })?.error?.message || res.statusText,
      (json as { error?: { code?: string } })?.error?.code,
      res.status
    );
  }
  return unwrap<T>(json);
}

export async function apiGetRaw<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: authHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (json as { error?: { message?: string } })?.error?.message || res.statusText,
      undefined,
      res.status
    );
  }
  return json as T;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface HealthData {
  status: string;
  auth?: string;
  persistence?: {
    enabled: boolean;
    status: string;
    schemaVersion: number | null;
    error?: string | null;
  };
}

export interface PluginInfo {
  name: string;
  version?: string;
  description?: string;
  tools?: unknown[];
  endpoints?: unknown[];
}

export interface ToolInfo {
  name: string;
  description?: string;
  plugin?: string;
  tags?: string[];
  inputSchema?: Record<string, unknown>;
}

export interface AuditEntry {
  timestamp: string;
  plugin?: string;
  operation?: string;
  actor?: string;
  success?: boolean;
  durationMs?: number;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatModelsData {
  provider: string;
  defaultModel: string;
  providerAvailable?: boolean;
  providerHint?: string | null;
  toolCount: number;
  persistenceEnabled?: boolean;
  models?: Array<{ provider?: string; name?: string; models?: string[]; available?: boolean }>;
  availableModels?: Array<{ provider?: string; name?: string; models?: string[]; available?: boolean }>;
  selectableModels?: string[];
}

export interface WhoamiData {
  auth?: { enabled?: boolean; scopes?: string[] };
  actor?: { type?: string } | null;
  project?: { id?: string; env?: string };
}
