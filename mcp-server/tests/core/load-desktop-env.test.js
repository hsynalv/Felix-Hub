import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadFelixDesktopEnv } from "../../src/core/sidecar/load-desktop-env.js";

describe("loadFelixDesktopEnv", () => {
  let dir;
  const saved = {};

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "felix-desktop-env-"));
    for (const k of ["SIDECAR_AUTH_TOKEN", "SIDECAR_PORT", "FELIX_HUB_URL"]) {
      if (process.env[k] !== undefined) saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    for (const [k, v] of Object.entries(saved)) {
      process.env[k] = v;
    }
    for (const k of ["SIDECAR_AUTH_TOKEN", "SIDECAR_PORT", "FELIX_HUB_URL"]) {
      if (!(k in saved)) delete process.env[k];
    }
  });

  it("returns loaded:false when env file missing", () => {
    const r = loadFelixDesktopEnv(dir);
    expect(r.loaded).toBe(false);
  });

  it("loads unset keys from env file", () => {
    writeFileSync(
      join(dir, "env"),
      `# comment\nSIDECAR_AUTH_TOKEN=secret-token\nSIDECAR_PORT=9478\n`,
    );
    const r = loadFelixDesktopEnv(dir);
    expect(r.loaded).toBe(true);
    expect(r.keys).toBe(2);
    expect(process.env.SIDECAR_AUTH_TOKEN).toBe("secret-token");
    expect(process.env.SIDECAR_PORT).toBe("9478");
  });

  it("does not override existing process.env", () => {
    process.env.SIDECAR_AUTH_TOKEN = "already-set";
    writeFileSync(join(dir, "env"), "SIDECAR_AUTH_TOKEN=from-file\n");
    loadFelixDesktopEnv(dir);
    expect(process.env.SIDECAR_AUTH_TOKEN).toBe("already-set");
  });
});
