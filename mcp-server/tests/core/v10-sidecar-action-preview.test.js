import { describe, it, expect } from "vitest";
import {
  buildSidecarActionPreview,
  sidecarRiskScore,
} from "../../src/core/v10/sidecar-action-preview.js";

describe("v10 sidecar action preview", () => {
  it("buildSidecarActionPreview returns stable shape for fs_list", () => {
    const preview = buildSidecarActionPreview(
      "fs_list",
      { path: "~/Documents", explanation: "list docs" },
      { channel: "web" }
    );
    expect(preview.toolName).toBe("fs_list");
    expect(preview.channel).toBe("web");
    expect(preview.target.type).toBe("filesystem");
    expect(preview.summary).toContain("list");
    expect(preview).toHaveProperty("risk");
    expect(preview).toHaveProperty("requiresApproval");
    expect(preview.artifacts).toBeDefined();
    expect(preview.undo).toBeDefined();
  });

  it("scores critical path higher", () => {
    const low = sidecarRiskScore("fs_list", { path: "~/Documents" });
    const high = sidecarRiskScore("fs_list", { path: "~/.ssh" });
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.risk).toBe("critical");
  });

  it("scores power terminal as critical", () => {
    const r = sidecarRiskScore("local_terminal_exec", { command: "npm test" });
    expect(r.risk).toBe("critical");
  });

  it("requires approval for fs_copy", () => {
    const preview = buildSidecarActionPreview(
      "fs_copy",
      { source: "~/Documents/a.txt", destination: "~/Documents/b.txt" },
      { channel: "telegram" }
    );
    expect(preview.requiresApproval).toBe(true);
    expect(preview.target.destination).toBe("~/Documents/b.txt");
  });

  it("preview for desktop_region_screenshot", () => {
    const preview = buildSidecarActionPreview("desktop_region_screenshot", {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(preview.target.type).toBe("screenshot");
    expect(preview.summary).toContain("region");
  });
});
