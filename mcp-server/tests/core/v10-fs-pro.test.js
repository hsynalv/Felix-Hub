import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import {
  fsStat,
  fsSearch,
  fsRecent,
  fsCopy,
  fsMove,
  fsDeleteToTrash,
} from "../../src/plugins/local-sidecar/fs-pro.core.js";
import { clearWhitelistCache } from "../../src/plugins/local-sidecar/whitelist.config.js";

describe("v10 fs-pro", () => {
  let workDir;

  beforeEach(async () => {
    clearWhitelistCache();
    workDir = await mkdtemp(join(homedir(), "Documents", "felix-fs-pro-"));
    await writeFile(join(workDir, "alpha.txt"), "hello");
    await writeFile(join(workDir, "beta.pdf"), "%PDF");
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("fs_stat returns metadata", async () => {
    const r = await fsStat(join(workDir, "alpha.txt"));
    expect(r.ok).toBe(true);
    expect(r.data.isFile).toBe(true);
    expect(r.data.size).toBe(5);
  });

  it("fs_search finds by pattern", async () => {
    const r = await fsSearch(workDir, { pattern: "alpha" });
    expect(r.ok).toBe(true);
    expect(r.data.matches.some((m) => m.name === "alpha.txt")).toBe(true);
  });

  it("fs_recent lists files by mtime", async () => {
    const r = await fsRecent(workDir, { limit: 5 });
    expect(r.ok).toBe(true);
    expect(r.data.count).toBeGreaterThan(0);
  });

  it("fs_copy duplicates file", async () => {
    const dest = join(workDir, "alpha-copy.txt");
    const r = await fsCopy(join(workDir, "alpha.txt"), dest);
    expect(r.ok).toBe(true);
    const s = await stat(dest);
    expect(s.isFile()).toBe(true);
  });

  it("fs_move renames file", async () => {
    const src = join(workDir, "alpha.txt");
    const dest = join(workDir, "moved.txt");
    const r = await fsMove(src, dest);
    expect(r.ok).toBe(true);
    const s = await stat(dest);
    expect(s.isFile()).toBe(true);
  });

  it("fs_delete_to_trash moves to ~/.Trash", async () => {
    const target = join(workDir, "beta.pdf");
    const r = await fsDeleteToTrash(target);
    expect(r.ok).toBe(true);
    expect(r.data.trashPath).toContain(".Trash");
    await expect(stat(target)).rejects.toThrow();
  });
});
