/**
 * User-facing path resolution (~, relative, absolute).
 */

import { join, resolve, isAbsolute, normalize } from "path";
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
