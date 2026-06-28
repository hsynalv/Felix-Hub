/**
 * Local Sidecar Plugin Tests (V10 path policy compatible)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { join, normalize } from "path";
import { homedir } from "os";
import {
  fsList,
  fsRead,
  fsWrite,
  fsHash,
  checkPathAllowed,
  resolveUserPath,
} from "../../src/plugins/local-sidecar/sidecar.core.js";
import { clearWhitelistCache } from "../../src/plugins/local-sidecar/whitelist.config.js";
import * as localSidecar from "../../src/plugins/local-sidecar/index.js";

vi.mock("fs/promises", async () => {
  const actual = await vi.importActual("fs/promises");
  return {
    ...actual,
    readdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
  };
});

import { readdir, readFile, writeFile, stat } from "fs/promises";

const DOCS = normalize(join(homedir(), "Documents"));

describe("Local Sidecar Plugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWhitelistCache();
  });

  describe("Plugin Metadata", () => {
    it("should have correct name and version", () => {
      expect(localSidecar.name).toBe("local-sidecar");
      expect(localSidecar.version).toBe("1.0.0");
    });

    it("should define fs tools including v10 pro tools", () => {
      const names = localSidecar.tools.map((t) => t.name);
      expect(names).toContain("fs_list");
      expect(names).toContain("fs_stat");
      expect(names).toContain("fs_search");
    });
  });

  describe("Path policy", () => {
    it("expands ~ to home directory", () => {
      expect(resolveUserPath("~/Downloads")).toBe(normalize(join(homedir(), "Downloads")));
    });

    it("allows ~/Documents", () => {
      const result = checkPathAllowed("~/Documents");
      expect(result.allowed).toBe(true);
    });

    it("requires approval for /etc without grant", () => {
      const result = checkPathAllowed("/etc/passwd");
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("approval_required");
    });
  });

  describe("fs_list", () => {
    it("lists directory contents under Documents", async () => {
      readdir.mockResolvedValue([
        { name: "file1.txt", isDirectory: () => false, isFile: () => true },
      ]);
      stat.mockResolvedValue({ size: 100, mtime: new Date("2024-01-01") });

      const result = await fsList("~/Documents");

      expect(result.ok).toBe(true);
      expect(result.data.count).toBe(1);
      expect(readdir).toHaveBeenCalledWith(DOCS, { withFileTypes: true });
    });

    it("denies system paths without approval", async () => {
      const result = await fsList("/etc");
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("approval_required");
    });
  });

  describe("fs_read", () => {
    it("reads file contents", async () => {
      const filePath = join(DOCS, "file.txt");
      stat.mockResolvedValue({
        isFile: () => true,
        size: 100,
        mtime: new Date("2024-01-01"),
      });
      readFile.mockResolvedValue("file content");

      const result = await fsRead("~/Documents/file.txt");

      expect(result.ok).toBe(true);
      expect(result.data.content).toBe("file content");
      expect(readFile).toHaveBeenCalledWith(filePath, "utf8");
    });
  });

  describe("fs_write", () => {
    it("writes file with undo metadata", async () => {
      readFile.mockRejectedValue(new Error("ENOENT"));
      stat.mockResolvedValue({ size: 13 });
      writeFile.mockResolvedValue();

      const result = await fsWrite("~/Documents/file.txt", "hello content");

      expect(result.ok).toBe(true);
      expect(result.data.undo).toBeDefined();
      expect(writeFile).toHaveBeenCalled();
    });
  });

  describe("fs_hash", () => {
    it("calculates SHA-256 hash", async () => {
      readFile.mockResolvedValue(Buffer.from("test content"));

      const result = await fsHash("~/Documents/file.txt");

      expect(result.ok).toBe(true);
      expect(result.data.hash).toHaveLength(64);
    });
  });
});
