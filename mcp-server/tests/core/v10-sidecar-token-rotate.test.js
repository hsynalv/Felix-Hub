import { describe, it, expect, beforeEach } from "vitest";
import {
  createPairingCode,
  consumePairingCode,
  rotateSidecarDeviceToken,
  getSidecarDevice,
  resetSidecarPairingForTests,
} from "../../src/core/sidecar/pairing.service.js";

describe("v10 sidecar token rotate", () => {
  beforeEach(() => {
    resetSidecarPairingForTests();
  });

  it("rotates device auth token", async () => {
    const { code } = createPairingCode();
    const paired = await consumePairingCode(code, {
      deviceName: "test-mac",
      baseUrl: "http://127.0.0.1:9477",
    });
    expect(paired.ok).toBe(true);
    const oldToken = paired.authToken;

    const rotated = await rotateSidecarDeviceToken(paired.device.id);
    expect(rotated.ok).toBe(true);
    expect(rotated.authToken).not.toBe(oldToken);

    const device = await getSidecarDevice(paired.device.id);
    expect(device.authToken).toBe(rotated.authToken);
    expect(device.tokenRotatedAt).toBeDefined();
  });
});
