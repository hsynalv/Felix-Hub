/**
 * Local Sidecar - Core
 *
 * Safe filesystem operations with whitelist enforcement.
 */

import { readdir, readFile, writeFile, stat } from "fs/promises";
import { createHash } from "crypto";
import { join } from "path";
import { fsPolicyDecide } from "./fs-path-policy.js";
import { resolveUserPath } from "./path-resolve.js";
import { fsDenyEnvelope } from "./fs-access.js";

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
 * Check if a path is allowed for the given operation.
 * @param {string} targetPath
 * @param {"list"|"read"|"write"|"hash"} [operation="read"]
 * @param {{ approvalGranted?: boolean }} [accessOpts]
 */
export function checkPathAllowed(targetPath, operation = "read", accessOpts = {}) {
  const policy = fsPolicyDecide(targetPath, operation);
  const { approvalGranted = false } = accessOpts;

  if (policy.blocked || !policy.allowed) {
    return {
      allowed: false,
      error: policy.reason || `Access denied: ${policy.resolvedPath}`,
      code: "access_denied",
      classification: policy.classification,
      requireApproval: policy.requireApproval,
    };
  }

  if (policy.requireApproval && !approvalGranted) {
    return {
      allowed: false,
      error: policy.reason || "Path requires explicit approval",
      code: "approval_required",
      classification: policy.classification,
      requireApproval: true,
    };
  }

  return {
    allowed: true,
    resolvedPath: policy.resolvedPath,
    classification: policy.classification,
    requireApproval: false,
  };
}

/**
 * List directory contents
 * @param {string} dirPath
 * @param {{ approvalGranted?: boolean }} [accessOpts]
 */
export async function fsList(dirPath, accessOpts = {}) {
  const check = checkPathAllowed(dirPath, "list", accessOpts);
  if (!check.allowed) return fsDenyEnvelope(check);

  try {
    const entries = await readdir(check.resolvedPath, { withFileTypes: true });

    const items = entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
      path: join(dirPath, entry.name),
    }));

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
 * @param {string} filePath
 * @param {Object} [options]
 * @param {string} [options.encoding]
 * @param {number} [options.maxSize]
 * @param {boolean} [options.approvalGranted]
 */
export async function fsRead(filePath, options = {}) {
  const { encoding = "utf8", maxSize = 1024 * 1024, approvalGranted = false } = options;
  const check = checkPathAllowed(filePath, "read", { approvalGranted });
  if (!check.allowed) return fsDenyEnvelope(check);

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
 * @param {string} filePath
 * @param {string} content
 * @param {{ approvalGranted?: boolean }} [options]
 */
export async function fsWrite(filePath, content, options = {}) {
  const check = checkPathAllowed(filePath, "write", options);
  if (!check.allowed) return fsDenyEnvelope(check);

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
 * @param {string} filePath
 * @param {{ approvalGranted?: boolean }} [accessOpts]
 */
export async function fsHash(filePath, accessOpts = {}) {
  const check = checkPathAllowed(filePath, "hash", accessOpts);
  if (!check.allowed) return fsDenyEnvelope(check);

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
