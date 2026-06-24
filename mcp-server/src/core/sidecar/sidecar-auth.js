/**
 * Sidecar shared-secret auth (mTLS placeholder for Faz E).
 */

import { randomBytes } from "crypto";

export function generateSidecarAuthToken() {
  return randomBytes(32).toString("hex");
}

export function validateSidecarRequest(req, expectedToken) {
  if (!expectedToken) return true;
  const header = req.headers?.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return token === expectedToken;
}
