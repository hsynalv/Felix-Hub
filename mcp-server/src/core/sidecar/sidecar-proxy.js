/**
 * Proxy local sidecar operations (fs, terminal, notify).
 */

import { getDefaultSidecarDevice, touchDevice, isLocalFsOnServer } from "./pairing.service.js";
import { auditLog } from "../audit/index.js";

export function requiresSidecarDelegation() {
  return !isLocalFsOnServer();
}

export function sidecarRequiredError() {
  return {
    ok: false,
    error: {
      code: "sidecar_required",
      message:
        "Local actions are delegated to a paired sidecar. Run `npm run sidecar:daemon` and pair via POST /sidecar/pair.",
    },
  };
}

async function fetchSidecar(path, { method = "GET", body = null, op = "sidecar" } = {}) {
  if (isLocalFsOnServer()) return null;

  const device = await getDefaultSidecarDevice();
  if (!device) return sidecarRequiredError();

  const start = Date.now();
  try {
    const url = `${device.baseUrl}${path}`;
    const headers = { Accept: "application/json" };
    if (device.authToken) headers.Authorization = `Bearer ${device.authToken}`;
    if (body) headers["Content-Type"] = "application/json";

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60_000),
    });
    const json = await res.json().catch(() => ({}));
    await touchDevice(device.id);

    void auditLog({
      plugin: "local-sidecar",
      operation: op,
      actor: "sidecar-proxy",
      allowed: true,
      success: json.ok !== false,
      durationMs: Date.now() - start,
      metadata: { path, deviceId: device.id },
    });

    return json;
  } catch (err) {
    void auditLog({
      plugin: "local-sidecar",
      operation: op,
      actor: "sidecar-proxy",
      allowed: true,
      success: false,
      durationMs: Date.now() - start,
      metadata: { path, error: err.message },
    });
    return {
      ok: false,
      error: { code: "sidecar_unreachable", message: err.message },
    };
  }
}

export async function delegateToSidecar(op, params) {
  const paths = {
    list: `/fs/list?path=${encodeURIComponent(params.path || ".")}`,
    read: `/fs/read?path=${encodeURIComponent(params.path)}&maxSize=${params.maxSize || 1048576}`,
    write: "/fs/write",
    hash: `/fs/hash?path=${encodeURIComponent(params.path)}`,
  };

  if (op === "write") {
    return fetchSidecar(paths.write, { method: "POST", body: params, op: "fs_write" });
  }
  const path = paths[op];
  if (!path) return { ok: false, error: { code: "invalid_op", message: `Unknown op: ${op}` } };
  return fetchSidecar(path, { op: `fs_${op}` });
}

export async function delegateTerminalExec(command, opts = {}) {
  return fetchSidecar("/terminal/exec", {
    method: "POST",
    body: { command, cwd: opts.cwd, timeoutMs: opts.timeoutMs },
    op: "terminal_exec",
  });
}

export async function delegateTerminalSessionCreate(cwd) {
  return fetchSidecar("/terminal/sessions", { method: "POST", body: { cwd }, op: "terminal_session_create" });
}

export async function delegateTerminalSessionExec(sessionId, command, opts = {}) {
  return fetchSidecar(`/terminal/sessions/${encodeURIComponent(sessionId)}/exec`, {
    method: "POST",
    body: { command, timeoutMs: opts.timeoutMs },
    op: "terminal_session_exec",
  });
}

export async function delegateNotify({ title, message }) {
  return fetchSidecar("/notify", { method: "POST", body: { title, message }, op: "desktop_notify" });
}

export async function delegateDesktopScreenshot(opts = {}) {
  const q = opts.format ? `?format=${encodeURIComponent(opts.format)}` : "";
  return fetchSidecar(`/desktop/screenshot${q}`, { op: "desktop_screenshot" });
}

export async function delegateDesktopActiveWindow() {
  return fetchSidecar("/desktop/active-window", { op: "desktop_active_window" });
}

export async function delegateDesktopOcr(body) {
  return fetchSidecar("/desktop/ocr", { method: "POST", body, op: "desktop_ocr" });
}

export async function delegateDesktopClick(body) {
  return fetchSidecar("/desktop/click", { method: "POST", body, op: "desktop_click" });
}

export async function delegateDesktopType(body) {
  return fetchSidecar("/desktop/type", { method: "POST", body, op: "desktop_type" });
}
