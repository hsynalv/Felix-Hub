/**
 * Server-side session store.
 */

import { createHash, randomBytes } from "crypto";
import { persistenceQuery, isPersistenceHealthy, randomUUID } from "../persistence/index.js";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * @param {{ userId: string; ip?: string; userAgent?: string }} opts
 */
export async function createSession({ userId, ip, userAgent }) {
  const sessionToken = generateToken();
  const refreshToken = generateToken();
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await persistenceQuery(
    `INSERT INTO hub_sessions
       (id, user_id, session_token_hash, refresh_token_hash, expires_at, refresh_expires_at, ip, user_agent)
     VALUES (@id, @userId, @sessionHash, @refreshHash, @expiresAt, @refreshExpiresAt, @ip, @userAgent)`,
    {
      id,
      userId,
      sessionHash: hashToken(sessionToken),
      refreshHash: hashToken(refreshToken),
      expiresAt,
      refreshExpiresAt,
      ip: ip?.slice(0, 64) ?? null,
      userAgent: userAgent?.slice(0, 512) ?? null,
    }
  );

  return { sessionToken, refreshToken, expiresAt, refreshExpiresAt };
}

/**
 * @param {string} sessionToken
 */
export async function validateSessionToken(sessionToken) {
  if (!sessionToken || !isPersistenceHealthy()) return null;
  const sessionHash = hashToken(sessionToken);
  const result = await persistenceQuery(
    `SELECT TOP 1 s.id AS session_id, s.user_id, s.expires_at, s.revoked_at,
            u.email, u.display_name, u.role, u.is_active
     FROM hub_sessions s
     INNER JOIN hub_users u ON u.id = s.user_id
     WHERE s.session_token_hash = @sessionHash`,
    { sessionHash }
  );
  const row = result?.recordset?.[0];
  if (!row || row.revoked_at) return null;
  if (!row.is_active) return null;
  if (new Date(row.expires_at) <= new Date()) return null;
  return {
    sessionId: String(row.session_id),
    userId: String(row.user_id),
    email: row.email,
    displayName: row.display_name,
    role: row.role,
  };
}

/**
 * @param {string} refreshToken
 */
export async function rotateSessionByRefresh(refreshToken, { ip, userAgent } = {}) {
  if (!refreshToken || !isPersistenceHealthy()) return null;
  const refreshHash = hashToken(refreshToken);
  const result = await persistenceQuery(
    `SELECT TOP 1 id, user_id, refresh_expires_at, revoked_at FROM hub_sessions
     WHERE refresh_token_hash = @refreshHash`,
    { refreshHash }
  );
  const row = result?.recordset?.[0];
  if (!row || row.revoked_at) return null;
  if (new Date(row.refresh_expires_at) <= new Date()) return null;

  await persistenceQuery(
    `UPDATE hub_sessions SET revoked_at = SYSUTCDATETIME() WHERE id = @id`,
    { id: row.id }
  );

  return createSession({ userId: String(row.user_id), ip, userAgent });
}

export async function revokeSessionByToken(sessionToken) {
  if (!sessionToken || !isPersistenceHealthy()) return;
  const sessionHash = hashToken(sessionToken);
  await persistenceQuery(
    `UPDATE hub_sessions SET revoked_at = SYSUTCDATETIME()
     WHERE session_token_hash = @sessionHash AND revoked_at IS NULL`,
    { sessionHash }
  );
}
