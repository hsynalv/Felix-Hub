/**
 * Overlay vs process.env diff (masked)
 */

import { listOverlayKeys } from "./effective-config.js";
import { maskSecret } from "./crypto.js";

const SENSITIVE = /KEY|TOKEN|SECRET|PASSWORD|URL|CONNECTION/i;

function maskKeyValue(key, value) {
  if (!value) return null;
  if (SENSITIVE.test(key)) return maskSecret(value);
  return value.length > 80 ? `${value.slice(0, 40)}…` : value;
}

export function computeSettingsDiff() {
  const overlayOnly = [];
  const envOnly = [];
  const conflicts = [];

  const overlayKeys = new Set(listOverlayKeys());
  const envKeys = new Set(
    Object.keys(process.env).filter((k) => /^[A-Z][A-Z0-9_]*$/.test(k))
  );

  for (const key of overlayKeys) {
    const overlayVal = process.env[key];
    const rawEnv = overlayVal;
    if (!envKeys.has(key) && overlayVal) {
      overlayOnly.push({ key, masked: maskKeyValue(key, overlayVal) });
    }
  }

  for (const key of envKeys) {
    if (!overlayKeys.has(key)) {
      envOnly.push({ key, masked: maskKeyValue(key, process.env[key]) });
    }
  }

  for (const key of overlayKeys) {
    if (envKeys.has(key)) {
      conflicts.push({
        key,
        note: "overlay takes precedence at runtime",
        masked: maskKeyValue(key, process.env[key]),
      });
    }
  }

  overlayOnly.sort((a, b) => a.key.localeCompare(b.key));
  envOnly.sort((a, b) => a.key.localeCompare(b.key));
  conflicts.sort((a, b) => a.key.localeCompare(b.key));

  return { overlayOnly, envOnly, conflicts };
}
