import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { homedir } from "os";
import { join } from "path";
import {
  fsClassifyPath,
  fsPolicyDecide,
} from "../../src/plugins/local-sidecar/fs-path-policy.js";
import { clearWhitelistCache } from "../../src/plugins/local-sidecar/whitelist.config.js";

describe("v10 fs-path-policy", () => {
  beforeEach(() => {
    clearWhitelistCache();
  });

  it("classifies Desktop as normal", () => {
    const r = fsClassifyPath("~/Desktop");
    expect(r.classification).toBe("normal");
  });

  it("classifies .ssh as critical", () => {
    const r = fsClassifyPath("~/.ssh");
    expect(r.classification).toBe("critical");
  });

  it("blocks /etc", () => {
    const r = fsClassifyPath("/etc/passwd");
    expect(r.classification).toBe("blocked");
    expect(fsPolicyDecide("/etc/passwd", "read").blocked).toBe(true);
  });

  it("requires approval for critical read", () => {
    const policy = fsPolicyDecide("~/.ssh", "list");
    expect(policy.allowed).toBe(true);
    expect(policy.requireApproval).toBe(true);
    expect(policy.classification).toBe("critical");
  });

  it("allows Documents list without approval", () => {
    const policy = fsPolicyDecide(join(homedir(), "Documents"), "list");
    expect(policy.allowed).toBe(true);
    expect(policy.requireApproval).toBe(false);
    expect(policy.classification).toBe("normal");
  });
});
