import { describe, it, expect } from "vitest";
import {
  checkSidecarDependencies,
  listSidecarCapabilityCatalog,
} from "../../src/plugins/local-sidecar/sidecar-health.core.js";

describe("v10 sidecar health", () => {
  it("checkSidecarDependencies returns checks array", async () => {
    const r = await checkSidecarDependencies();
    expect(r.ok).toBe(true);
    expect(Array.isArray(r.data.checks)).toBe(true);
    expect(r.data.checks.some((c) => c.name === "osascript")).toBe(true);
  });

  it("listSidecarCapabilityCatalog includes browser", () => {
    const r = listSidecarCapabilityCatalog();
    expect(r.ok).toBe(true);
    expect(r.data.capabilities.some((c) => c.id === "browser")).toBe(true);
  });
});
