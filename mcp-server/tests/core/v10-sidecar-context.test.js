import { describe, it, expect, beforeEach } from "vitest";
import { enrichSidecarToolContext } from "../../src/core/sidecar/sidecar-context.js";
import {
  consumePairingCode,
  createPairingCode,
  resetSidecarPairingForTests,
} from "../../src/core/sidecar/pairing.service.js";

describe("v10 sidecar context", () => {
  beforeEach(() => {
    resetSidecarPairingForTests();
    delete process.env.LOCAL_FS_ON_SERVER;
  });

  it("injects sidecarCapabilities from paired device", async () => {
    process.env.LOCAL_FS_ON_SERVER = "false";
    const { code } = createPairingCode();
    await consumePairingCode(code, {
      deviceName: "mac",
      baseUrl: "http://127.0.0.1:9477",
      capabilities: ["fs", "browser"],
    });

    const ctx = await enrichSidecarToolContext({ actor: "test" });
    expect(ctx.sidecarCapabilities).toEqual(["fs", "browser"]);
    expect(ctx.sidecarDeviceId).toBeDefined();
  });
});
