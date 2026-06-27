/**
 * Local Sidecar - Core
 *
 * Safe filesystem operations with whitelist enforcement.
 */

import { readdir, readFile, writeFile, stat } from "fs/promises";
import { createHash } from "crypto";
import { join, normalize } from "path";
import { fsPolicyDecide } from "./fs-path-policy.js";
import { resolveUserPath } from "./path-resolve.js";

export { resolveUserPath };

/**
 * @param {Buffer} buf
 * @returns {{ width: number, height: number } | null}
 */
function imageDimensionsFromBuffer(buf, ext) {
  if (!buf || buf.length < 24) return null;
  if (ext === "png" && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  return null;
}

/**
 * Check if a path is within whitelisted directories
 * @param {string} targetPath - Path to check
 * @returns {{allowed: boolean, resolvedPath?: string, error?: string}}
 */
export function checkPathAllowed(targetPath, operation = "read") {
  const policy = fsPolicyDecide(targetPath, operation);

  if (policy.blocked || !policy.allowed) {
    return {
      allowed: false,
      error: policy.reason || `Access denied: ${policy.resolvedPath}`,
      classification: policy.classification,
      requireApproval: policy.requireApproval,
    };
  }

  return {
    allowed: true,
    resolvedPath: policy.resolvedPath,
    classification: policy.classification,
    requireApproval: policy.requireApproval,
  };
}

/**
 * List directory contents
 * @param {string} dirPath - Directory path
 * @returns {Promise<{ok: boolean, data?: Object, error?: Object}>}
 */
export async function fsList(dirPath) {
  const check = checkPathAllowed(dirPath, "list");
  if (!check.allowed) {
    return { ok: false, error: { code: "access_denied", message: check.error } };
  }

  try {
    const entries = await readdir(check.resolvedPath, { withFileTypes: true });
    
    const items = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
      path: join(dirPath, entry.name),
    }));

    // Get stats for each item
    const itemsWithStats = await Promise.all(
      items.map(async (item) => {
        try {
          const itemStat = await stat(join(check.resolvedPath, item.name));
          return {
            ...item,
            size: itemStat.size,
            modified: itemStat.mtime.toISOString(),
          };
        } catch {
          return item;
        }
      })
    );

    return {
      ok: true,
      data: {
        path: dirPath,
        resolvedPath: check.resolvedPath,
        items: itemsWithStats,
        count: items.length,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: { code: "fs_error", message: err.message },
    };
  }
}

/**
 * Read file contents
 * @param {string} filePath - File path
 * @param {Object} options - Options
 * @param {string} options.encoding - File encoding (default: utf8)
 * @param {number} options.maxSize - Max bytes to read (default: 1MB)
 * @returns {Promise<{ok: boolean, data?: Object, error?: Object}>}
 */
export async function fsRead(filePath, options = {}) {
  const check = checkPathAllowed(filePath, "read");
  if (!check.allowed) {
    return { ok: false, error: { code: "access_denied", message: check.error } };
  }

  const encoding = options.encoding || "utf8";
  const maxSize = options.maxSize || 1024 * 1024; // 1MB default

  try {
    const fileStat = await stat(check.resolvedPath);
    
    if (!fileStat.isFile()) {
      return { ok: false, error: { code: "not_a_file", message: "Path is not a file" } };
    }

    if (fileStat.size > maxSize) {
      return {
        ok: false,
        error: {
          code: "file_too_large",
          message: `File size (${fileStat.size} bytes) exceeds max (${maxSize} bytes)`,
        },
      };
    }

    const content = await readFile(check.resolvedPath, encoding);

    return {
      ok: true,
      data: {
        path: filePath,
        resolvedPath: check.resolvedPath,
        content,
        size: fileStat.size,
        modified: fileStat.mtime.toISOString(),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: { code: "fs_error", message: err.message },
    };
  }
}

/**
 * Write file contents
 * @param {string} filePath - File path
 * @param {string} content - Content to write
 * @param {Object} options - Options
 * @param {boolean} options.createDirs - Create parent directories if missing
 * @returns {Promise<{ok: boolean, data?: Object, error?: Object}>}
 */
export async function fsWrite(filePath, content, options = {}) {
  const check = checkPathAllowed(filePath, "write");
  if (!check.allowed) {
    return { ok: false, error: { code: "access_denied", message: check.error } };
  }

  try {
    let backup = null;
    try {
      const existing = await readFile(check.resolvedPath, "utf8");
      const existingStat = await stat(check.resolvedPath);
      backup = {
        type: "fs_write_restore",
        path: filePath,
        resolvedPath: check.resolvedPath,
        content: existing,
        hadFile: true,
        previousSize: existingStat.size,
      };
    } catch {
      backup = {
        type: "fs_write_restore",
        path: filePath,
        resolvedPath: check.resolvedPath,
        hadFile: false,
      };
    }

    await writeFile(check.resolvedPath, content, "utf8");

    const fileStat = await stat(check.resolvedPath);

    return {
      ok: true,
      data: {
        path: filePath,
        resolvedPath: check.resolvedPath,
        size: fileStat.size,
        written: content.length,
        undo: backup,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: { code: "fs_error", message: err.message },
    };
  }
}

/**
 * Calculate file hash (SHA-256)
 * @param {string} filePath - File path
 * @returns {Promise<{ok: boolean, data?: Object, error?: Object}>}
 */
export async function fsHash(filePath) {
  const check = checkPathAllowed(filePath, "hash");
  if (!check.allowed) {
    return { ok: false, error: { code: "access_denied", message: check.error } };
  }

  try {
    const content = await readFile(check.resolvedPath);
    
    const hash = createHash("sha256");
    hash.update(content);
    const digest = hash.digest("hex");

    return {
      ok: true,
      data: {
        path: filePath,
        resolvedPath: check.resolvedPath,
        hash: digest,
        algorithm: "sha256",
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: { code: "fs_error", message: err.message },
    };
  }
}
