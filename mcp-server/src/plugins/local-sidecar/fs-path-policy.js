/**
 * V10 — Filesystem path classification and access policy.
 */

import { homedir } from "os";
import { normalize, sep } from "path";
import { resolvePathForPolicy } from "./path-resolve.js";
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

/** System paths: approval-required critical, not hard-blocked. */
const SYSTEM_CRITICAL_PREFIXES = [
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

const CRITICAL_CONFIG_SUBDIRS = new Set([
  "gh",
  "gcloud",
  "gitea",
  "azure",
  "aws",
  "docker",
  "kube",
]);

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

function pathWithTrailingSep(resolved) {
  const p = normalize(resolved);
  return p.endsWith(sep) ? p : `${p}${sep}`;
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

function matchesBlockedRoot(resolved) {
  return normalize(resolved) === "/";
}

function matchesSystemCritical(resolved) {
  const p = normalize(resolved);
  return SYSTEM_CRITICAL_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(prefix + sep)
  );
}

function matchesCritical(resolved) {
  const p = pathWithTrailingSep(resolved);
  const markers = [
    `${sep}.ssh${sep}`,
    `${sep}.gnupg${sep}`,
    `${sep}.aws${sep}`,
    `${sep}.kube${sep}`,
    `${sep}.docker${sep}`,
    `${sep}Keychains${sep}`,
    `${sep}Application Support${sep}`,
  ];
  if (markers.some((m) => p.includes(m))) return true;

  const segments = pathSegments(resolved);
  if (segments.some((s) => [".ssh", ".gnupg", ".aws", ".kube", ".docker"].includes(s))) {
    return true;
  }
  if (segments.includes("Keychains")) return true;
  if (segments.includes("Application Support")) return true;

  const configIdx = segments.indexOf(".config");
  if (configIdx >= 0) {
    const sub = segments[configIdx + 1];
    if (sub && CRITICAL_CONFIG_SUBDIRS.has(sub)) return true;
  }

  const base = segments[segments.length - 1] || "";
  return CRITICAL_FILE_PATTERNS.some((re) => re.test(base));
}

/**
 * @param {string} targetPath
 * @returns {{ classification: PathClassification, resolvedPath: string, reason?: string }}
 */
export function fsClassifyPath(targetPath) {
  const resolvedPath = resolvePathForPolicy(targetPath);

  if (matchesBlockedRoot(resolvedPath)) {
    return {
      classification: "blocked",
      resolvedPath,
      reason: "Filesystem root is not accessible via sidecar",
    };
  }

  if (matchesSystemCritical(resolvedPath)) {
    return {
      classification: "critical",
      resolvedPath,
      reason: "System path requires explicit approval",
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
