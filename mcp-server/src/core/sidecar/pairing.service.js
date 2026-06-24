/**
 * Sidecar device pairing — one-time codes + registered devices (memory).
 */

import { randomUUID, randomInt } from "crypto";
import { generateSidecarAuthToken } from "./sidecar-auth.js";

/** @type {Map<string, { code: string, expiresAt: number }>} */
const pendingCodes = new Map();

/** @type {Map<string, object>} */
const devices = new Map();

const CODE_TTL_MS = 5 * 60 * 1000;

export function isLocalFsOnServer() {
  const v = process.env.LOCAL_FS_ON_SERVER;
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export function createPairingCode({ createdBy = "admin" } = {}) {
  const id = randomUUID();
  const code = String(randomInt(100000, 999999));
  pendingCodes.set(code, {
    id,
    code,
    createdBy,
    expiresAt: Date.now() + CODE_TTL_MS,
  });
  return { id, code, expiresInSec: CODE_TTL_MS / 1000 };
}

export function consumePairingCode(code, { deviceName, baseUrl, capabilities = ["fs"] }) {
  const pending = pendingCodes.get(code);
  if (!pending) return { ok: false, error: "invalid_code" };
  if (Date.now() > pending.expiresAt) {
    pendingCodes.delete(code);
    return { ok: false, error: "expired_code" };
  }
  pendingCodes.delete(code);

  const device = {
    id: randomUUID(),
    name: deviceName || "sidecar",
    baseUrl: baseUrl.replace(/\/$/, ""),
    capabilities,
    authToken: generateSidecarAuthToken(),
    pairedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  };
  devices.set(device.id, device);
  return { ok: true, device, authToken: device.authToken };
}

export function listSidecarDevices() {
  return [...devices.values()];
}

export function getSidecarDevice(deviceId) {
  return devices.get(deviceId) || null;
}

export function getDefaultSidecarDevice() {
  const all = listSidecarDevices();
  return all.length ? all[all.length - 1] : null;
}

export function touchDevice(deviceId) {
  const d = devices.get(deviceId);
  if (d) d.lastSeenAt = new Date().toISOString();
  return d;
}

export function removeSidecarDevice(deviceId) {
  return devices.delete(deviceId);
}

export function resetSidecarPairingForTests() {
  pendingCodes.clear();
  devices.clear();
}
