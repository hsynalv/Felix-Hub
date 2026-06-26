/**
 * Session cookie → req.user
 */

import { getCookie, SESSION_COOKIE } from "./cookies.js";
import { validateSessionToken } from "./sessions.service.js";
import { userNamespaceForId } from "./request-context.js";

const USER_SCOPES = ["read", "write", "admin"];

/**
 * @param {import('express').Request} req
 */
export function buildUserFromSession(session) {
  return {
    userId: session.userId,
    email: session.email,
    displayName: session.displayName,
    role: session.role,
    namespace: userNamespaceForId(session.userId),
    sessionId: session.sessionId,
    scopes: USER_SCOPES,
  };
}

/**
 * Populate req.user from hub_session cookie (async).
 */
export async function resolveSessionUser(req) {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const session = await validateSessionToken(token);
  if (!session) return null;
  return buildUserFromSession(session);
}

/**
 * Express middleware — sets req.user when session valid.
 */
export function sessionMiddleware(req, res, next) {
  resolveSessionUser(req)
    .then((user) => {
      if (user) req.user = user;
      next();
    })
    .catch(next);
}
