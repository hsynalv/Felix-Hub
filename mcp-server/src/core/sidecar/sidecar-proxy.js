/**
 * Proxy local sidecar operations (fs, terminal, notify).
 */

import { getDefaultSidecarDevice, touchDevice, isLocalFsOnServer } from "./pairing.service.js";
import { auditLog } from "../audit/index.js";
import { signedSidecarHeaders, sidecarSignedRequestsEnabled } from "./sidecar-auth.js";
import { FS_APPROVAL_HEADER } from "../../plugins/local-sidecar/fs-access.js";

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

function capabilityForOp(op) {
  if (!op || typeof op !== "string") return null;
  if (op.startsWith("fs_")) return "fs";
  if (op.startsWith("terminal")) return "terminal";
  if (op === "desktop_notify") return "notify";
  if (op.startsWith("desktop_")) return "desktop";
  if (op.startsWith("browser_")) return "browser";
  if (op.startsWith("clipboard_")) return "desktop";
  if (op === "sidecar_dependency_check" || op === "desktop_permission_check") return null;
  return null;
}

async function fetchSidecar(path, { method = "GET", body = null, op = "sidecar", approvalGranted = false } = {}) {
  if (isLocalFsOnServer()) return null;

  const device = await getDefaultSidecarDevice();
  if (!device) return sidecarRequiredError();

  const capability = capabilityForOp(op);
  const caps = device.capabilities || ["fs"];
  if (capability && !caps.includes(capability)) {
    return {
      ok: false,
      error: {
        code: "sidecar_capability_denied",
        message: `Paired device lacks '${capability}' capability (have: ${caps.join(", ")})`,
      },
    };
  }

  const start = Date.now();
  try {
    const url = `${device.baseUrl}${path}`;
    const headers = { Accept: "application/json" };
    const bodyStr = body ? JSON.stringify(body) : null;
    if (device.authToken) headers.Authorization = `Bearer ${device.authToken}`;
    if (body) headers["Content-Type"] = "application/json";
    if (approvalGranted) headers[FS_APPROVAL_HEADER] = "1";
    if (sidecarSignedRequestsEnabled() && device.authToken) {
      Object.assign(headers, signedSidecarHeaders(device.authToken, method, path, body));
    }

    const res = await fetch(url, {
      method,
      headers,
      body: bodyStr ?? undefined,
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
      metadata: {
        path,
        deviceId: device.id,
        capability,
        op,
        undoId: json?.data?.undoRecordId || null,
      },
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
  const approvalGranted = Boolean(params?.approvalGranted);
  const approvalQuery = approvalGranted ? "&approvalGranted=1" : "";
  const paths = {
    list: `/fs/list?path=${encodeURIComponent(params.path || ".")}${approvalQuery}`,
    read: `/fs/read?path=${encodeURIComponent(params.path)}&maxSize=${params.maxSize || 1048576}${approvalQuery}`,
    write: "/fs/write",
    hash: `/fs/hash?path=${encodeURIComponent(params.path)}${approvalQuery}`,
    stat: `/fs/stat?path=${encodeURIComponent(params.path)}${approvalQuery}`,
    recent: `/fs/recent?path=${encodeURIComponent(params.path || ".")}&limit=${params.limit || 20}&maxDepth=${params.maxDepth || 3}${approvalQuery}`,
    search: `/fs/search?path=${encodeURIComponent(params.path || ".")}&pattern=${encodeURIComponent(params.pattern || "")}&extension=${encodeURIComponent(params.extension || "")}&maxResults=${params.maxResults || 50}&maxDepth=${params.maxDepth || 4}${approvalQuery}`,
  };

  if (op === "write") {
    return fetchSidecar(paths.write, {
      method: "POST",
      body: { ...params, approvalGranted: approvalGranted || undefined },
      op: "fs_write",
      approvalGranted,
    });
  }
  if (op === "copy") {
    return fetchSidecar("/fs/copy", {
      method: "POST",
      body: { source: params.source, destination: params.destination, approvalGranted: approvalGranted || undefined },
      op: "fs_copy",
      approvalGranted,
    });
  }
  if (op === "move") {
    return fetchSidecar("/fs/move", {
      method: "POST",
      body: { source: params.source, destination: params.destination, approvalGranted: approvalGranted || undefined },
      op: "fs_move",
      approvalGranted,
    });
  }
  if (op === "delete_to_trash") {
    return fetchSidecar("/fs/delete-to-trash", {
      method: "POST",
      body: { path: params.path, approvalGranted: approvalGranted || undefined },
      op: "fs_delete_to_trash",
      approvalGranted,
    });
  }
  const path = paths[op];
  if (!path) return { ok: false, error: { code: "invalid_op", message: `Unknown op: ${op}` } };
  return fetchSidecar(path, { op: `fs_${op}`, approvalGranted });
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

export async function delegateDesktopRegionScreenshot(opts = {}) {
  const q = new URLSearchParams({
    x: String(opts.x),
    y: String(opts.y),
    width: String(opts.width),
    height: String(opts.height),
    format: opts.format || "png",
  });
  return fetchSidecar(`/desktop/screenshot/region?${q}`, { op: "desktop_region_screenshot" });
}

export async function delegateDesktopWindowScreenshot(opts = {}) {
  const q = opts.format ? `?format=${encodeURIComponent(opts.format)}` : "";
  return fetchSidecar(`/desktop/screenshot/window${q}`, { op: "desktop_window_screenshot" });
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

export async function delegateDesktopScroll(body) {
  return fetchSidecar("/desktop/scroll", { method: "POST", body, op: "desktop_scroll" });
}

export async function delegateDesktopHotkey(body) {
  return fetchSidecar("/desktop/hotkey", { method: "POST", body, op: "desktop_hotkey" });
}

export async function delegateDesktopDrag(body) {
  return fetchSidecar("/desktop/drag", { method: "POST", body, op: "desktop_drag" });
}

export async function delegateDesktopFocusApp(body) {
  return fetchSidecar("/desktop/focus-app", { method: "POST", body, op: "desktop_focus_app" });
}

export async function delegateClipboardRead() {
  return fetchSidecar("/clipboard/read", { op: "clipboard_read" });
}

export async function delegateClipboardWrite(body) {
  return fetchSidecar("/clipboard/write", { method: "POST", body, op: "clipboard_write" });
}

export async function delegateBrowserOpen(body) {
  return fetchSidecar("/browser/open", { method: "POST", body, op: "browser_open_url" });
}

export async function delegateBrowserSnapshot() {
  return fetchSidecar("/browser/snapshot", { op: "browser_snapshot" });
}

export async function delegateBrowserScreenshot() {
  return fetchSidecar("/browser/screenshot", { op: "browser_screenshot" });
}

export async function delegateBrowserExtractLinks(body) {
  const q = body?.maxLinks ? `?maxLinks=${body.maxLinks}` : "";
  return fetchSidecar(`/browser/extract-links${q}`, { op: "browser_extract_links" });
}

export async function delegateBrowserExtractTable(body) {
  const q = body?.maxTables ? `?maxTables=${body.maxTables}` : "";
  return fetchSidecar(`/browser/extract-table${q}`, { op: "browser_extract_table" });
}

export async function delegateBrowserFindText(body) {
  const q = new URLSearchParams({
    query: body.query,
    maxMatches: String(body.maxMatches || 10),
  });
  return fetchSidecar(`/browser/find-text?${q}`, { op: "browser_find_text" });
}

export async function delegateBrowserClick(body) {
  return fetchSidecar("/browser/click", { method: "POST", body, op: "browser_click" });
}

export async function delegateBrowserType(body) {
  return fetchSidecar("/browser/type", { method: "POST", body, op: "browser_type" });
}

export async function delegateSidecarDependencies() {
  return fetchSidecar("/health/dependencies", { op: "sidecar_dependency_check" });
}

export async function delegateDesktopPermissions() {
  return fetchSidecar("/desktop/permissions", { op: "desktop_permission_check" });
}
