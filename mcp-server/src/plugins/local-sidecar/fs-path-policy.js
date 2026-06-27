/**
 * V10 — Filesystem path classification and access policy.
 */

import { homedir } from "os";
import { normalize, sep } from "path";
import { resolveUserPath } from "./path-resolve.js";
import { loadWhitelistConfig } from "./whitelist.config.js";

/** @typedef {"normal"|"sensitive"|"critical"|"blocked"} PathClassification */
/** @typedef {"list"|"read"|"write"|"hash"} FsOperation */

const USER_HOME_BUCKETS = [
  "Desktop",
  "Documents",
  "Downloads",
  "Pictures",
  "Movies",
  "Music",
  "Public",
];

const BLOCKED_PREFIXES = [
  "/etc",
  "/var",
  "/System",
  "/Library",
  "/Applications",
  "/usr",
  "/bin",
  "/sbin",
  "/private/etc",
  "/private/var",
];

const CRITICAL_DIR_SEGMENTS = [
  ".ssh",
  ".gnupg",
  ".aws",
  ".config/gh",
  ".netrc",
  "Keychains",
];

const CRITICAL_FILE_PATTERNS = [
  /^\.env(\.|$)/i,
  /credentials/i,
  /secret/i,
  /id_rsa/i,
  /id_ed25519/i,
  /\.pem$/i,
  /token/i,
  /password/i,
];

function pathSegments(resolved) {
  return normalize(resolved).split(sep).filter(Boolean);
}

function isUnderHome(resolved) {
  const home = normalize(homedir());
  return resolved === home || resolved.startsWith(home + sep);
}

function isUnderCwd(resolved) {
  const cwd = normalize(process.cwd());
  return resolved === cwd || resolved.startsWith(cwd + sep);
}

function isUserHomeBucket(resolved) {
  const home = normalize(homedir());
  return USER_HOME_BUCKETS.some((bucket) => {
    const bucketPath = normalize(`${home}${sep}${bucket}`);
    return resolved === bucketPath || resolved.startsWith(bucketPath + sep);
  });
}

function matchesBlockedPrefix(resolved) {
  const p = normalize(resolved);
  if (p === "/") return true;
  return BLOCKED_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(prefix + sep)
  );
}

function matchesCritical(resolved) {
  const segments = pathSegments(resolved);
  if (segments.some((s) => CRITICAL_DIR_SEGMENTS.includes(s))) return true;
  const base = segments[segments.length - 1] || "";
  return CRITICAL_FILE_PATTERNS.some((re) => re.test(base));
}

/**
 * @param {string} targetPath
 * @returns {{ classification: PathClassification, resolvedPath: string, reason?: string }}
 */
export function fsClassifyPath(targetPath) {
  const resolvedPath = resolveUserPath(targetPath);

  if (matchesBlockedPrefix(resolvedPath)) {
    return {
      classification: "blocked",
      resolvedPath,
      reason: "System path is not accessible via sidecar",
    };
  }

  if (matchesCritical(resolvedPath)) {
    return {
      classification: "critical",
      resolvedPath,
      reason: "May contain secrets or credentials",
    };
  }

  if (
    isUserHomeBucket(resolvedPath) ||
    isUnderHome(resolvedPath) ||
    isUnderCwd(resolvedPath) ||
    loadWhitelistConfig().some((allowed) => {
      const a = normalize(allowed);
      return resolvedPath === a || resolvedPath.startsWith(a + sep);
    })
  ) {
    return { classification: "normal", resolvedPath };
  }

  return {
    classification: "sensitive",
    resolvedPath,
    reason: "Path outside standard user directories",
  };
}

/**
 * @param {string} targetPath
 * @param {FsOperation} [operation="read"]
 */
export function fsPolicyDecide(targetPath, operation = "read") {
  const { classification, resolvedPath, reason } = fsClassifyPath(targetPath);
  const op = operation === "list" ? "read" : operation;

  if (classification === "blocked") {
    return {
      allowed: false,
      blocked: true,
      requireApproval: false,
      classification,
      resolvedPath,
      reason,
    };
  }

  if (classification === "critical") {
    return {
      allowed: true,
      blocked: false,
      requireApproval: true,
      classification,
      resolvedPath,
      reason: reason || "Critical path requires explicit approval",
    };
  }

  if (classification === "sensitive") {
    const requireApproval = op === "write" || op === "read";
    return {
      allowed: true,
      blocked: false,
      requireApproval,
      classification,
      resolvedPath,
      reason: reason || "Non-standard path",
    };
  }

  if (op === "write") {
    return {
      allowed: true,
      blocked: false,
      requireApproval: false,
      classification,
      resolvedPath,
      reason: null,
    };
  }

  return {
    allowed: true,
    blocked: false,
    requireApproval: false,
    classification,
    resolvedPath,
    reason: null,
  };
}

/**
 * @param {string} targetPath
 * @param {FsOperation} [operation="read"]
 */
export function fsAccessPreview(targetPath, operation = "read") {
  const policy = fsPolicyDecide(targetPath, operation);
  return {
    path: targetPath,
    resolvedPath: policy.resolvedPath,
    operation,
    classification: policy.classification,
    requireApproval: policy.requireApproval,
    blocked: policy.blocked,
    reason: policy.reason,
  };
}
