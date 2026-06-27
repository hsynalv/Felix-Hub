/**
 * Isolated CATALOG_CACHE_DIR for tests — avoids polluting ./cache/prompt-intelligence.
 */

import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * @returns {string} temp directory path
 */
export function installTempCacheDir() {
  const dir = mkdtempSync(join(tmpdir(), "mcp-hub-test-"));
  process.env.CATALOG_CACHE_DIR = dir;
  return dir;
}

/**
 * @param {string} [dir]
 */
export function restoreCacheDir(dir) {
  if (dir) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  delete process.env.CATALOG_CACHE_DIR;
}
