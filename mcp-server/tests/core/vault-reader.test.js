/**
 * Vault reader tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { searchVaultNotes, readVaultNote } from "../../src/core/project-context/vault-reader.js";

describe("Vault reader", () => {
  let vaultDir;

  beforeEach(async () => {
    vaultDir = await mkdtemp(join(tmpdir(), "vault-test-"));
    await mkdir(join(vaultDir, "notes"), { recursive: true });
    await writeFile(
      join(vaultDir, "notes", "auth.md"),
      "# Auth flow\n\nJWT tokens are used for API access.\n",
      "utf8"
    );
  });

  afterEach(async () => {
    vaultDir = null;
  });

  it("searches notes by query", async () => {
    const result = await searchVaultNotes(vaultDir, "JWT", { limit: 5, sinceDays: 30 });
    expect(result.ok).toBe(true);
    expect(result.data.notes.length).toBeGreaterThanOrEqual(1);
    expect(result.data.notes[0].title).toContain("Auth");
  });

  it("reads note by relative path", async () => {
    const result = await readVaultNote(vaultDir, "notes/auth.md");
    expect(result.ok).toBe(true);
    expect(result.data.content).toContain("JWT");
  });

  it("blocks path traversal", async () => {
    const result = await readVaultNote(vaultDir, "../etc/passwd");
    expect(result.ok).toBe(false);
  });
});
