/**
 * Sidecar pairing tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createPairingCode,
  consumePairingCode,
  listSidecarDevices,
  isLocalFsOnServer,
  resetSidecarPairingForTests,
} from "../../src/core/sidecar/pairing.service.js";
import { delegateToSidecar } from "../../src/core/sidecar/sidecar-proxy.js";

describe("Sidecar pairing", () => {
  beforeEach(() => {
    resetSidecarPairingForTests();
    delete process.env.LOCAL_FS_ON_SERVER;
  });

  it("pairs device with valid code", () => {
    const { code } = createPairingCode();
    const result = consumePairingCode(code, {
      deviceName: "test-mac",
      baseUrl: "http://127.0.0.1:9477",
    });
    expect(result.ok).toBe(true);
    expect(result.authToken).toBeDefined();
    expect(listSidecarDevices()[0].authToken).toBeDefined();
  });

  it("rejects invalid code", () => {
    const result = consumePairingCode("000000", { baseUrl: "http://127.0.0.1:9477" });
    expect(result.ok).toBe(false);
  });

  it("delegates when LOCAL_FS_ON_SERVER=false", async () => {
    process.env.LOCAL_FS_ON_SERVER = "false";
    const result = await delegateToSidecar("list", { path: "." });
    expect(result?.ok).toBe(false);
    expect(result?.error?.code).toBe("sidecar_required");
  });

  it("defaults local fs on server in development", () => {
    process.env.NODE_ENV = "development";
    expect(isLocalFsOnServer()).toBe(true);
  });
});
