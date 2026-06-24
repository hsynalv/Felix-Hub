/**
 * Master key rotation — re-encrypt all settings_encrypted rows
 */

import {
  persistenceQuery,
  isPersistenceHealthy,
} from "../persistence/index.js";
import {
  decryptWithKey,
  encryptWithKey,
  initMasterKey,
  isMasterKeyConfigured,
  setMasterKeyBuffer,
  setCurrentKeyVersion,
  getCurrentKeyVersion,
} from "./crypto.js";
import { writeConfigAudit } from "./settings.service.js";
import { loadSettingsOverlay } from "./effective-config.js";

function rowToBuffer(val) {
  if (Buffer.isBuffer(val)) return val;
  if (val == null) return Buffer.alloc(0);
  return Buffer.from(val);
}

function parseNewKey(base64) {
  const buf = Buffer.from(String(base64).trim(), "base64");
  if (buf.length !== 32) {
    throw Object.assign(new Error("newMasterKeyBase64 must decode to 32 bytes"), { code: "invalid_key" });
  }
  return buf;
}

export async function rotateMasterKey({ newMasterKeyBase64, dryRun = false, actor = null } = {}) {
  if (!isMasterKeyConfigured()) {
    throw Object.assign(new Error("HUB_SETTINGS_MASTER_KEY is not configured"), { code: "master_key_missing" });
  }
  if (!isPersistenceHealthy()) {
    throw Object.assign(new Error("Persistence is not healthy"), { code: "persistence_unavailable" });
  }

  const oldKey = Buffer.from(process.env.HUB_SETTINGS_MASTER_KEY.trim(), "base64");
  const newKey = parseNewKey(newMasterKeyBase64);

  const result = await persistenceQuery(
    `SELECT key_name, namespace, ciphertext, iv, auth_tag, key_version FROM settings_encrypted`
  );
  const rows = result?.recordset ?? [];
  const failures = [];
  const rotated = [];

  let maxVersion = getCurrentKeyVersion();
  for (const row of rows) {
    maxVersion = Math.max(maxVersion, row.key_version || 1);
  }
  const nextVersion = maxVersion + 1;

  for (const row of rows) {
    const keyName = row.key_name;
    const namespace = row.namespace;
    try {
      const plaintext = decryptWithKey(oldKey, {
        ciphertext: rowToBuffer(row.ciphertext),
        iv: rowToBuffer(row.iv),
        authTag: rowToBuffer(row.auth_tag),
      });
      if (!dryRun) {
        const { ciphertext, iv, authTag, keyVersion } = encryptWithKey(newKey, plaintext, nextVersion);
        await persistenceQuery(
          `UPDATE settings_encrypted SET ciphertext = @ciphertext, iv = @iv, auth_tag = @authTag,
           key_version = @keyVersion, updated_at = SYSUTCDATETIME()
           WHERE key_name = @keyName AND namespace = @namespace`,
          { keyName, namespace, ciphertext, iv, authTag, keyVersion }
        );
      }
      rotated.push({ keyName, namespace });
    } catch (e) {
      failures.push({ keyName, namespace, error: e.message });
    }
  }

  if (!dryRun && failures.length === 0) {
    process.env.HUB_SETTINGS_MASTER_KEY = newMasterKeyBase64.trim();
    setMasterKeyBuffer(newKey);
    setCurrentKeyVersion(nextVersion);
    initMasterKey();
    await loadSettingsOverlay();
    await writeConfigAudit({
      operation: "rotate_master_key",
      keyName: "*",
      actor,
      success: true,
    });
  }

  return {
    dryRun,
    rotated: rotated.length,
    failures,
    nextKeyVersion: nextVersion,
    applied: !dryRun && failures.length === 0,
  };
}
