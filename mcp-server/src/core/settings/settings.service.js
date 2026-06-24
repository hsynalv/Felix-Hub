/**
 * Encrypted settings + connection_profiles CRUD (MSSQL)
 */

import {
  persistenceQuery,
  isPersistenceHealthy,
  randomUUID,
} from "../persistence/index.js";
import { encrypt, decrypt, maskSecret, isMasterKeyConfigured } from "./crypto.js";
import { normalizeNotionIdIfApplicable } from "../../plugins/notion/notion-ids.js";

const DEFAULT_NS = "default";

function rowToBuffer(val) {
  if (Buffer.isBuffer(val)) return val;
  if (val == null) return Buffer.alloc(0);
  return Buffer.from(val);
}

export async function listSettings(namespace = DEFAULT_NS) {
  if (!isPersistenceHealthy()) return [];
  const result = await persistenceQuery(
    `SELECT key_name, namespace, key_version, updated_by, created_at, updated_at
     FROM settings_encrypted WHERE namespace = @namespace ORDER BY key_name`,
    { namespace }
  );
  return (result?.recordset ?? []).map((r) => ({
    keyName: r.key_name,
    namespace: r.namespace,
    keyVersion: r.key_version,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    maskedValue: "••••••••",
  }));
}

export async function getSettingDecrypted(keyName, namespace = DEFAULT_NS) {
  if (!isPersistenceHealthy()) return null;
  const result = await persistenceQuery(
    `SELECT TOP 1 ciphertext, iv, auth_tag, key_version FROM settings_encrypted
     WHERE key_name = @keyName AND namespace = @namespace`,
    { keyName, namespace }
  );
  const row = result?.recordset?.[0];
  if (!row) return null;
  const value = decrypt({
    ciphertext: rowToBuffer(row.ciphertext),
    iv: rowToBuffer(row.iv),
    authTag: rowToBuffer(row.auth_tag),
  });
  return { keyName, namespace, value, keyVersion: row.key_version };
}

export async function listAllSettingsDecrypted(namespace = DEFAULT_NS) {
  if (!isPersistenceHealthy()) return [];
  const result = await persistenceQuery(
    `SELECT key_name, ciphertext, iv, auth_tag, key_version FROM settings_encrypted WHERE namespace = @namespace`,
    { namespace }
  );
  const out = [];
  for (const row of result?.recordset ?? []) {
    try {
      const value = decrypt({
        ciphertext: rowToBuffer(row.ciphertext),
        iv: rowToBuffer(row.iv),
        authTag: rowToBuffer(row.auth_tag),
      });
      out.push({ keyName: row.key_name, value, keyVersion: row.key_version });
    } catch (e) {
      console.warn(`[settings] decrypt failed for ${row.key_name}:`, e.message);
    }
  }
  return out;
}

export async function upsertSetting(keyName, value, { namespace = DEFAULT_NS, updatedBy = null } = {}) {
  if (!isMasterKeyConfigured()) {
    throw Object.assign(new Error("HUB_SETTINGS_MASTER_KEY is required to store settings"), { code: "master_key_missing" });
  }
  if (!isPersistenceHealthy()) {
    throw Object.assign(new Error("Persistence is not healthy"), { code: "persistence_unavailable" });
  }
  const storedValue = normalizeNotionIdIfApplicable(keyName, value);
  const { ciphertext, iv, authTag, keyVersion } = encrypt(storedValue);
  await persistenceQuery(
    `
    MERGE settings_encrypted AS target
    USING (SELECT @keyName AS key_name, @namespace AS namespace) AS source
    ON target.key_name = source.key_name AND target.namespace = source.namespace
    WHEN MATCHED THEN
      UPDATE SET ciphertext = @ciphertext, iv = @iv, auth_tag = @authTag,
        key_version = @keyVersion, updated_by = @updatedBy, updated_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
      INSERT (key_name, ciphertext, iv, auth_tag, key_version, namespace, updated_by)
      VALUES (@keyName, @ciphertext, @iv, @authTag, @keyVersion, @namespace, @updatedBy);
    `,
    {
      keyName,
      namespace,
      ciphertext,
      iv,
      authTag,
      keyVersion,
      updatedBy,
    }
  );
  return { keyName, namespace, maskedValue: maskSecret(value), updatedBy };
}

export async function deleteSetting(keyName, namespace = DEFAULT_NS) {
  if (!isPersistenceHealthy()) return false;
  await persistenceQuery(
    `DELETE FROM settings_encrypted WHERE key_name = @keyName AND namespace = @namespace`,
    { keyName, namespace }
  );
  return true;
}

export async function listConnectionProfiles(namespace = DEFAULT_NS) {
  if (!isPersistenceHealthy()) return [];
  const result = await persistenceQuery(
    `SELECT id, profile_name, profile_type, config_json, secret_ref_id, is_default, is_active, namespace, created_at, updated_at
     FROM connection_profiles WHERE namespace = @namespace ORDER BY profile_name`,
    { namespace }
  );
  return (result?.recordset ?? []).map((r) => ({
    id: r.id,
    profileName: r.profile_name,
    profileType: r.profile_type,
    config: JSON.parse(r.config_json || "{}"),
    secretRefId: r.secret_ref_id,
    isDefault: !!r.is_default,
    isActive: !!r.is_active,
    namespace: r.namespace,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function upsertConnectionProfile({
  id,
  profileName,
  profileType,
  config = {},
  secretRefId = null,
  isDefault = false,
  isActive = true,
  namespace = DEFAULT_NS,
}) {
  if (!isPersistenceHealthy()) {
    throw Object.assign(new Error("Persistence is not healthy"), { code: "persistence_unavailable" });
  }
  const profileId = id || randomUUID();
  const configJson = JSON.stringify(config);

  if (isDefault) {
    await persistenceQuery(
      `UPDATE connection_profiles SET is_default = 0 WHERE namespace = @namespace AND profile_type = @profileType`,
      { namespace, profileType }
    );
  }

  await persistenceQuery(
    `
    MERGE connection_profiles AS target
    USING (SELECT @profileId AS id) AS source
    ON target.id = source.id
    WHEN MATCHED THEN
      UPDATE SET profile_name = @profileName, profile_type = @profileType, config_json = @configJson,
        secret_ref_id = @secretRefId, is_default = @isDefault, is_active = @isActive, updated_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
      INSERT (id, profile_name, profile_type, config_json, secret_ref_id, is_default, is_active, namespace)
      VALUES (@profileId, @profileName, @profileType, @configJson, @secretRefId, @isDefault, @isActive, @namespace);
    `,
    {
      profileId,
      profileName,
      profileType,
      configJson,
      secretRefId,
      isDefault: isDefault ? 1 : 0,
      isActive: isActive ? 1 : 0,
      namespace,
    }
  );
  return { id: profileId, profileName, profileType, isDefault, isActive };
}

export async function writeConfigAudit({ operation, keyName, actor, success = true }) {
  if (!isPersistenceHealthy()) return;
  await persistenceQuery(
    `
    INSERT INTO audit_archive (
      event_id, event_type, plugin_name, operation, actor, scope, success, payload_json, namespace, occurred_at
    ) VALUES (
      @eventId, 'config', 'settings', @operation, @actor, 'admin', @success,
      @payloadJson, @namespace, SYSUTCDATETIME()
    )
    `,
    {
      eventId: randomUUID(),
      operation,
      actor: actor || "system",
      success: success ? 1 : 0,
      payloadJson: JSON.stringify({ keyName }),
      namespace: DEFAULT_NS,
    }
  );
}
