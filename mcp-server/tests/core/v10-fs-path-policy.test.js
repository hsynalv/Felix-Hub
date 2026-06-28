import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { mkdtempSync, symlinkSync, rmSync, writeFileSync, mkdirSync } from "fs";
import {
  fsClassifyPath,
  fsPolicyDecide,
} from "../../src/plugins/local-sidecar/fs-path-policy.js";
import { checkPathAllowed } from "../../src/plugins/local-sidecar/sidecar.core.js";
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

  it("classifies .config/gh as critical", () => {
    const r = fsClassifyPath("~/.config/gh/hosts.yml");
    expect(r.classification).toBe("critical");
  });

  it("classifies Application Support as critical", () => {
    const r = fsClassifyPath("~/Library/Application Support/some-app");
    expect(r.classification).toBe("critical");
  });

  it("classifies /etc as critical (approval-required, not blocked)", () => {
    const r = fsClassifyPath("/etc/passwd");
    expect(r.classification).toBe("critical");
    const policy = fsPolicyDecide("/etc/passwd", "read");
    expect(policy.blocked).toBe(false);
    expect(policy.requireApproval).toBe(true);
  });

  it("blocks filesystem root /", () => {
    const r = fsClassifyPath("/");
    expect(r.classification).toBe("blocked");
    expect(fsPolicyDecide("/", "read").blocked).toBe(true);
  });

  it("requires approval for critical read at enforcement layer", () => {
    const policy = fsPolicyDecide("~/.ssh", "list");
    expect(policy.allowed).toBe(true);
    expect(policy.requireApproval).toBe(true);
    expect(policy.classification).toBe("critical");

    const denied = checkPathAllowed("~/.ssh", "list");
    expect(denied.allowed).toBe(false);
    expect(denied.code).toBe("approval_required");

    const granted = checkPathAllowed("~/.ssh", "list", { approvalGranted: true });
    expect(granted.allowed).toBe(true);
  });

  it("allows Documents list without approval", () => {
    const policy = fsPolicyDecide(join(homedir(), "Documents"), "list");
    expect(policy.allowed).toBe(true);
    expect(policy.requireApproval).toBe(false);
    expect(policy.classification).toBe("normal");
  });

  it("follows symlinks for policy classification", () => {
    const base = mkdtempSync(join(tmpdir(), "felix-fs-policy-"));
    try {
      const secretDir = join(base, "secret");
      mkdirSync(secretDir);
      writeFileSync(join(secretDir, "key.pem"), "x");
      const linkPath = join(base, "link.pem");
      symlinkSync(join(secretDir, "key.pem"), linkPath);

      const r = fsClassifyPath(linkPath);
      expect(r.classification).toBe("critical");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
