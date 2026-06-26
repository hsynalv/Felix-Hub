/**
 * Team membership — project-scoped roles (JSON file + memory fallback).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { createHash, randomUUID } from "crypto";

/** @type {{ memberships: object[] } | null} */
let memoryStore = null;

export function resetTeamMembershipForTests() {
  memoryStore = { memberships: [] };
}

function storePath() {
  const dir = process.env.CATALOG_CACHE_DIR || "./cache";
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "team-memberships.json");
}

function load() {
  if (memoryStore) return memoryStore;
  const p = storePath();
  if (!existsSync(p)) return { memberships: [] };
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return { memberships: [] };
  }
}

function save(data) {
  if (memoryStore) {
    memoryStore = data;
    return;
  }
  writeFileSync(storePath(), JSON.stringify(data, null, 2));
}

const VALID_ROLES = new Set(["owner", "admin", "member", "viewer"]);

export function isTeamMembershipEnforced() {
  return process.env.TEAM_MEMBERSHIP_ENFORCE === "true" || process.env.TEAM_MEMBERSHIP_ENFORCE === "1";
}

export function projectHasMembershipPolicy(projectId) {
  return listProjectMembers(projectId).length > 0;
}

export function listProjectMembers(projectId) {
  const data = load();
  return (data.memberships || []).filter((m) => m.projectId === projectId);
}

export function listUserMemberships(userId) {
  const data = load();
  return (data.memberships || []).filter((m) => m.userId === userId);
}

export function addProjectMember({ projectId, userId, role = "member", addedBy = "system" }) {
  if (!projectId || !userId) {
    throw Object.assign(new Error("projectId and userId required"), { code: "invalid_request" });
  }
  if (!VALID_ROLES.has(role)) {
    throw Object.assign(new Error(`Invalid role: ${role}`), { code: "invalid_role" });
  }

  const data = load();
  data.memberships ??= [];

  const existing = data.memberships.find((m) => m.projectId === projectId && m.userId === userId);
  if (existing) {
    existing.role = role;
    existing.updatedAt = new Date().toISOString();
    save(data);
    return existing;
  }

  const membership = {
    id: `mem-${createHash("sha256").update(randomUUID()).digest("hex").slice(0, 8)}`,
    projectId,
    userId,
    role,
    addedBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.memberships.push(membership);
  save(data);
  return membership;
}

export function removeProjectMember(projectId, userId) {
  const data = load();
  const before = (data.memberships || []).length;
  data.memberships = (data.memberships || []).filter(
    (m) => !(m.projectId === projectId && m.userId === userId)
  );
  save(data);
  return before !== data.memberships.length;
}

export function getMemberRole(projectId, userId) {
  const m = listProjectMembers(projectId).find((x) => x.userId === userId);
  return m?.role || null;
}

export function canAccessProject(projectId, userId, { minRole = "viewer" } = {}) {
  const roleOrder = { viewer: 0, member: 1, admin: 2, owner: 3 };
  const enforce = isTeamMembershipEnforced() || projectHasMembershipPolicy(projectId);

  if (!enforce) return true;
  if (!userId) return false;

  const role = getMemberRole(projectId, userId);
  if (!role) return false;
  return (roleOrder[role] ?? 0) >= (roleOrder[minRole] ?? 0);
}

export function assertProjectAccess(projectId, userId, opts = {}) {
  if (canAccessProject(projectId, userId, opts)) return { allowed: true };
  return {
    allowed: false,
    error: {
      code: "project_access_denied",
      message: `User does not have ${opts.minRole || "viewer"}+ access to project ${projectId}`,
    },
  };
}
