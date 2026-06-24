/**
 * Encrypted settings bundle export/import
 */

import {
  listAllSettingsDecrypted,
  listConnectionProfiles,
  upsertSetting,
  upsertConnectionProfile,
} from "./settings.service.js";
import {
  encryptBlob,
  decryptBlob,
  isMasterKeyConfigured,
} from "./crypto.js";

function getMasterKeyBuf() {
  const raw = process.env.HUB_SETTINGS_MASTER_KEY?.trim();
  if (!raw) {
    throw Object.assign(new Error("HUB_SETTINGS_MASTER_KEY is not configured"), { code: "master_key_missing" });
  }
  return Buffer.from(raw, "base64");
}

export async function exportSettingsBundle() {
  if (!isMasterKeyConfigured()) {
    throw Object.assign(new Error("HUB_SETTINGS_MASTER_KEY is not configured"), { code: "master_key_missing" });
  }
  const settings = await listAllSettingsDecrypted();
  const profiles = await listConnectionProfiles();
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: settings.map((s) => ({ keyName: s.keyName, value: s.value, keyVersion: s.keyVersion })),
    profiles: profiles.map((p) => ({
      profileName: p.profileName,
      profileType: p.profileType,
      config: p.config,
      isDefault: p.isDefault,
      isActive: p.isActive,
      namespace: p.namespace,
    })),
  };
  const encrypted = encryptBlob(getMasterKeyBuf(), payload);
  return { encrypted, meta: { settings: settings.length, profiles: profiles.length } };
}

export async function importSettingsBundle(encrypted, { mode = "merge", dryRun = false } = {}) {
  if (!isMasterKeyConfigured()) {
    throw Object.assign(new Error("HUB_SETTINGS_MASTER_KEY is not configured"), { code: "master_key_missing" });
  }
  const payload = decryptBlob(getMasterKeyBuf(), encrypted);
  const result = { importedSettings: 0, importedProfiles: 0, skipped: 0 };

  if (mode === "replace" && !dryRun) {
    // merge-only for settings; replace clears via caller responsibility
  }

  for (const s of payload.settings || []) {
    if (dryRun) {
      result.importedSettings++;
      continue;
    }
    await upsertSetting(s.keyName, s.value, { namespace: "default", updatedBy: "import" });
    result.importedSettings++;
  }

  for (const p of payload.profiles || []) {
    if (dryRun) {
      result.importedProfiles++;
      continue;
    }
    await upsertConnectionProfile({
      profileName: p.profileName,
      profileType: p.profileType,
      config: p.config || {},
      isDefault: p.isDefault,
      isActive: p.isActive !== false,
      namespace: p.namespace || "default",
    });
    result.importedProfiles++;
  }

  return { ...result, exportedAt: payload.exportedAt, version: payload.version, dryRun };
}
