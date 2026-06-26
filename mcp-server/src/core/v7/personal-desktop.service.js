/**
 * V7 — Personal desktop assistant (sidecar status + allowlist + capture).
 */

import { isLocalFsOnServer } from "../sidecar/pairing.service.js";
import { getDefaultSidecarDevice } from "../sidecar/pairing.service.js";
import {
  requiresSidecarDelegation,
  delegateDesktopScreenshot,
  delegateDesktopActiveWindow,
  delegateToSidecar,
} from "../sidecar/sidecar-proxy.js";
import {
  captureScreenshot,
  getActiveWindow,
} from "../../plugins/local-sidecar/desktop.core.js";
import { fsRead, fsList } from "../../plugins/local-sidecar/sidecar.core.js";
import { getPersonalDesktopConfig, updatePersonalDesktopConfig, DESKTOP_MODES } from "./personal-desktop-store.js";
import { evaluateScreenSafety } from "./personal-ops.service.js";
import { getPersonalAutonomyState } from "./personal-autonomy.service.js";

export async function getPersonalDesktopStatus() {
  const config = getPersonalDesktopConfig();
  const autonomy = getPersonalAutonomyState();
  const needsSidecar = requiresSidecarDelegation();
  const device = needsSidecar ? await getDefaultSidecarDevice() : null;

  return {
    mode: config.mode,
    effectiveDesktopMode: autonomy.desktopMode,
    modes: DESKTOP_MODES,
    allowlist: {
      apps: config.allowedApps,
      domains: config.allowedDomains,
    },
    sidecar: {
      required: needsSidecar,
      paired: !!device,
      deviceName: device?.name || null,
      capabilities: device?.capabilities || [],
    },
    tools: [
      "desktop_screenshot",
      "desktop_active_window",
      "desktop_ocr",
      "desktop_click",
      "desktop_type",
    ],
  };
}

export function getDesktopAllowlist() {
  const config = getPersonalDesktopConfig();
  return {
    mode: config.mode,
    allowedApps: config.allowedApps,
    allowedDomains: config.allowedDomains,
  };
}

export function updateDesktopAllowlist(patch) {
  return updatePersonalDesktopConfig(patch);
}

async function activeWindowSnapshot() {
  if (isLocalFsOnServer()) {
    const r = await getActiveWindow();
    return r.ok ? r.data : null;
  }
  const r = await delegateDesktopActiveWindow();
  return r?.ok ? r.data : null;
}

async function screenshotSnapshot() {
  if (isLocalFsOnServer()) {
    return captureScreenshot({ format: "png" });
  }
  return delegateDesktopScreenshot({ format: "png" });
}

export async function capturePersonalDesktopPreview() {
  const windowData = await activeWindowSnapshot();
  const screenshotRes = await screenshotSnapshot();
  const app = windowData?.app || windowData?.application || "";
  const title = windowData?.title || "";

  const safety = evaluateScreenSafety({ app, title });

  return {
    ok: !safety.blocked,
    blocked: safety.blocked,
    safety,
    activeWindow: windowData,
    screenshot: screenshotRes?.ok
      ? {
          captured: true,
          format: screenshotRes.data?.format || "png",
          width: screenshotRes.data?.width,
          height: screenshotRes.data?.height,
          /** base64 omitted from API by default — use sidecar directly for full image */
          hasImage: !!screenshotRes.data?.base64,
        }
      : {
          captured: false,
          error: screenshotRes?.error?.message || "Sidecar screenshot unavailable",
        },
    preview: safety.redactedPreview,
  };
}

export async function readPersonalSidecarFile(path, { maxChars = 4000 } = {}) {
  const result = isLocalFsOnServer()
    ? await fsRead(path, { maxSize: maxChars * 2 })
    : await delegateToSidecar("read", { path, maxSize: maxChars * 2 });
  if (!result?.ok) return result;
  const content = result.data?.content || result.data?.text || "";
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return {
    ok: true,
    data: {
      path,
      preview: text.slice(0, maxChars),
      truncated: text.length > maxChars,
      size: text.length,
    },
  };
}

export async function listPersonalSidecarDir(path = ".") {
  if (isLocalFsOnServer()) return fsList(path);
  return delegateToSidecar("list", { path });
}
