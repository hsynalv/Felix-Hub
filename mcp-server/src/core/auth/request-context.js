/**
 * Per-request tenant context (AsyncLocalStorage).
 */

import { AsyncLocalStorage } from "async_hooks";

/** @type {AsyncLocalStorage<{ userId: string; namespace: string; email?: string }|null>} */
const storage = new AsyncLocalStorage();

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requestContextMiddleware(req, res, next) {
  const user = req.user;
  if (user?.userId && user?.namespace) {
    storage.run({ userId: user.userId, namespace: user.namespace, email: user.email }, () => next());
  } else {
    storage.run(null, () => next());
  }
}

export function getRequestContext() {
  return storage.getStore() ?? null;
}

export function userNamespaceForId(userId) {
  return `user:${userId}`;
}
