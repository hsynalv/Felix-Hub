/**
 * Seed owner user + migrate global settings to user namespace.
 */

import { persistenceQuery, isPersistenceHealthy } from "../persistence/index.js";
import { createUser, findUserByEmail, hasAnyUsers, invalidateUsersExistCache } from "./users.service.js";
import { userNamespaceForId } from "./request-context.js";

const DEFAULT_SEED_EMAIL = "hhsynalv@gmail.com";

export async function seedOwnerAndMigrateSettings() {
  if (!isPersistenceHealthy()) return { seeded: false, reason: "persistence_unavailable" };

  const seedEmail = (process.env.HUB_SEED_EMAIL || DEFAULT_SEED_EMAIL).trim().toLowerCase();
  const seedPassword = process.env.HUB_SEED_PASSWORD?.trim();
  let owner = await findUserByEmail(seedEmail);

  if (!owner && seedPassword) {
    owner = await createUser({
      email: seedEmail,
      password: seedPassword,
      displayName: process.env.HUB_SEED_DISPLAY_NAME || "Hüseyin Alav",
      role: "owner",
    });
    console.log(`[auth] Seeded owner user: ${owner.email}`);
  } else if (!owner && !seedPassword) {
    const anyUsers = await hasAnyUsers();
    if (!anyUsers) {
      console.warn(
        "[auth] No users in hub_users. Set HUB_SEED_PASSWORD in .env or use /auth/register."
      );
    }
  } else if (owner) {
    console.log(`[auth] Owner user exists: ${owner.email}`);
  }

  if (owner) {
    await migrateDefaultNamespaceToUser(owner.id);
  }

  invalidateUsersExistCache();
  return { seeded: !!owner, ownerId: owner?.id ?? null };
}

async function migrateDefaultNamespaceToUser(userId) {
  const userNs = userNamespaceForId(userId);

  const settings = await persistenceQuery(
    `SELECT key_name FROM settings_encrypted WHERE namespace = 'default'`
  );
  for (const row of settings?.recordset ?? []) {
    const keyName = row.key_name;
    const exists = await persistenceQuery(
      `SELECT TOP 1 1 AS x FROM settings_encrypted WHERE key_name = @keyName AND namespace = @userNs`,
      { keyName, userNs }
    );
    if (exists?.recordset?.[0]) continue;
    await persistenceQuery(
      `UPDATE settings_encrypted SET namespace = @userNs, updated_at = SYSUTCDATETIME()
       WHERE key_name = @keyName AND namespace = 'default'`,
      { keyName, userNs }
    );
  }

  await persistenceQuery(
    `UPDATE connection_profiles SET namespace = @userNs, updated_at = SYSUTCDATETIME()
     WHERE namespace = 'default'`,
    { userNs }
  );

  await persistenceQuery(
    `UPDATE chat_conversations SET namespace = @userNs, updated_at = SYSUTCDATETIME()
     WHERE namespace = 'default'`,
    { userNs }
  );
}
