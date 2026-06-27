/**
 * V10 Faz E — HMAC signed sidecar requests (optional transport hardening).
 */

import { createHmac, timingSafeEqual } from "crypto";

const MAX_SKEW_MS = Number(process.env.SIDECAR_SIGNATURE_MAX_SKEW_MS || 5 * 60 * 1000);

/**
 * @param {string} token
 * @param {string} method
 * @param {string} path
 * @param {string|number} timestamp
 * @param {string} [body=""]
 */
export function buildSidecarSignature(token, method, path, timestamp, body = "") {
  const payload = `${String(method).toUpperCase()}\n${path}\n${timestamp}\n${body}`;
  return createHmac("sha256", token).update(payload).digest("hex");
}

/**
 * @param {import('express').Request} req
 * @param {string} expectedToken
 */
export function validateSidecarSignedRequest(req, expectedToken) {
  if (!expectedToken) return false;

  const timestamp = req.headers["x-felix-timestamp"];
  const signature = req.headers["x-felix-signature"];
  if (!timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) return false;

  const body =
    req.method === "GET" || req.method === "HEAD"
      ? ""
      : typeof req.rawBody === "string"
        ? req.rawBody
        : JSON.stringify(req.body ?? {});

  const expected = buildSidecarSignature(expectedToken, req.method, req.path, timestamp, body);

  try {
    const a = Buffer.from(String(signature), "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Build signed headers for outbound sidecar fetch.
 * @param {string} token
 * @param {string} method
 * @param {string} path
 * @param {object|null} body
 */
export function signedSidecarHeaders(token, method, path, body = null) {
  const timestamp = String(Date.now());
  const bodyStr = body ? JSON.stringify(body) : "";
  const signature = buildSidecarSignature(token, method, path, timestamp, bodyStr);
  return {
    "X-Felix-Timestamp": timestamp,
    "X-Felix-Signature": signature,
  };
}

export function sidecarSignedRequestsEnabled() {
  return process.env.SIDECAR_SIGNED_REQUESTS === "true";
}
