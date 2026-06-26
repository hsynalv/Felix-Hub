/**
 * Hub user accounts (MSSQL).
 */

import { persistenceQuery, isPersistenceHealthy, randomUUID } from "../persistence/index.js";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "./password.js";
import { userNamespaceForId } from "./request-context.js";

/** @type {boolean|null} */
let usersExistCache = null;

export async function hasAnyUsers() {
  if (usersExistCache !== null) return usersExistCache;
  if (!isPersistenceHealthy()) {
    usersExistCache = false;
    return false;
  }
  const result = await persistenceQuery(`SELECT TOP 1 id FROM hub_users`);
  usersExistCache = (result?.recordset?.length ?? 0) > 0;
  return usersExistCache;
}

export function invalidateUsersExistCache() {
  usersExistCache = null;
}

function mapUser(row) {
  return {
    id: String(row.id),
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: !!row.is_active,
    namespace: userNamespaceForId(String(row.id)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findUserByEmail(email) {
  if (!isPersistenceHealthy()) return null;
  const result = await persistenceQuery(
    `SELECT TOP 1 id, email, password_hash, display_name, role, is_active, created_at, updated_at
     FROM hub_users WHERE email = @email`,
    { email: email.trim().toLowerCase() }
  );
  const row = result?.recordset?.[0];
  if (!row) return null;
  return { ...mapUser(row), passwordHash: row.password_hash };
}

export async function findUserById(id) {
  if (!isPersistenceHealthy()) return null;
  const result = await persistenceQuery(
    `SELECT TOP 1 id, email, display_name, role, is_active, created_at, updated_at
     FROM hub_users WHERE id = @id`,
    { id }
  );
  const row = result?.recordset?.[0];
  return row ? mapUser(row) : null;
}

export async function createUser({ email, password, displayName, role = "user" }) {
  const policy = validatePasswordPolicy(password);
  if (!policy.ok) {
    throw Object.assign(new Error(policy.message), { code: "invalid_password" });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw Object.assign(new Error("Bu e-posta zaten kayıtlı"), { code: "email_taken" });
  }
  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  const name = (displayName || normalizedEmail.split("@")[0]).trim().slice(0, 128);
  await persistenceQuery(
    `INSERT INTO hub_users (id, email, password_hash, display_name, role, is_active)
     VALUES (@id, @email, @passwordHash, @displayName, @role, 1)`,
    { id, email: normalizedEmail, passwordHash, displayName: name, role }
  );
  invalidateUsersExistCache();
  return findUserById(id);
}

export async function verifyUserCredentials(email, password) {
  const user = await findUserByEmail(email);
  if (!user || !user.isActive) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}
