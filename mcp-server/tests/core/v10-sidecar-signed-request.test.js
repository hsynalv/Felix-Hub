import { describe, it, expect } from "vitest";
import {
  buildSidecarSignature,
  validateSidecarSignedRequest,
} from "../../src/core/sidecar/sidecar-signed-request.js";

describe("v10 sidecar signed request", () => {
  const token = "test-secret-token";
  const path = "/fs/list";
  const method = "GET";
  const ts = String(Date.now());

  it("builds deterministic HMAC signature", () => {
    const a = buildSidecarSignature(token, method, path, ts, "");
    const b = buildSidecarSignature(token, method, path, ts, "");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("validates matching request headers", () => {
    const signature = buildSidecarSignature(token, method, path, ts, "");
    const req = {
      method: "GET",
      path,
      headers: {
        "x-felix-timestamp": ts,
        "x-felix-signature": signature,
      },
      body: {},
    };
    expect(validateSidecarSignedRequest(req, token)).toBe(true);
  });

  it("rejects tampered signature", () => {
    const req = {
      method: "GET",
      path,
      headers: {
        "x-felix-timestamp": ts,
        "x-felix-signature": "deadbeef",
      },
      body: {},
    };
    expect(validateSidecarSignedRequest(req, token)).toBe(false);
  });
});
