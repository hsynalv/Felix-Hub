/**
 * Sidecar shared-secret auth + optional HMAC signed requests (V10 Faz E).
 */

import { randomBytes } from "crypto";
import {
  validateSidecarSignedRequest,
  sidecarSignedRequestsEnabled,
} from "./sidecar-signed-request.js";

export function generateSidecarAuthToken() {
  return randomBytes(32).toString("hex");
}

export function validateSidecarRequest(req, expectedToken) {
  if (!expectedToken) return true;

  if (sidecarSignedRequestsEnabled()) {
    if (validateSidecarSignedRequest(req, expectedToken)) return true;
    // When signed mode is on, still allow Bearer for pairing/health probes if explicitly disabled strict mode
    if (process.env.SIDECAR_SIGNED_REQUESTS_STRICT === "true") return false;
  }

  const header = req.headers?.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return token === expectedToken;
}

export { sidecarSignedRequestsEnabled, buildSidecarSignature, signedSidecarHeaders } from "./sidecar-signed-request.js";
