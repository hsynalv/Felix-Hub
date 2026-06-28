/**
 * User-facing path resolution (~, relative, absolute).
 */

import { existsSync, realpathSync } from "fs";
import { join, resolve, isAbsolute, normalize, dirname, basename } from "path";
import { homedir } from "os";

/**
 * @param {string} targetPath
 * @returns {string}
 */
export function resolveUserPath(targetPath) {
  if (!targetPath || typeof targetPath !== "string") {
    return normalize(process.cwd());
  }
  let p = targetPath.trim();
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    p = join(homedir(), p.slice(2));
  }
  return isAbsolute(p) ? normalize(p) : normalize(join(process.cwd(), p));
}

/**
 * Resolve symlinks for policy checks (realpath when path or parent exists).
 * @param {string} targetPath
 * @returns {string}
 */
export function resolvePathForPolicy(targetPath) {
  const resolved = resolveUserPath(targetPath);
  try {
    if (existsSync(resolved)) {
      return realpathSync(resolved);
    }
    const parent = dirname(resolved);
    const name = basename(resolved);
    if (parent !== resolved && existsSync(parent)) {
      return join(realpathSync(parent), name);
    }
  } catch {
    /* keep logical path */
  }
  return resolved;
}
