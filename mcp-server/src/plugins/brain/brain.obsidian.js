/**
 * Optional Obsidian vault export — secondary to in-hub Brain UI
 */

import { mkdir, writeFile, rename, access } from "fs/promises";
import { join, dirname } from "path";
import { createHash } from "crypto";
import {
  getMemory,
  listMemories,
  listProjects,
  getProfile,
} from "./brain.memory.js";

const NAMESPACE = process.env.BRAIN_NAMESPACE || process.env.BRAIN_USER_ID || "default";

function isExportEnabled() {
  return (
    process.env.OBSIDIAN_EXPORT_ENABLED === "true" &&
    Boolean(process.env.OBSIDIAN_VAULT_PATH?.trim())
  );
}

function vaultRoot() {
  return join(process.env.OBSIDIAN_VAULT_PATH.trim(), "mcp-hub");
}

function hashContent(content) {
  return createHash("sha256").update(String(content)).digest("hex");
}

function memoryRelPath(mem) {
  return join("memories", mem.type || "fact", `${mem.id}.md`);
}

function toFrontmatter(mem) {
  const lines = [
    "---",
    `id: "${mem.id}"`,
    `type: ${mem.type}`,
    `tags: [${(mem.tags || []).map((t) => `"${t}"`).join(", ")}]`,
    mem.projectId ? `project: ${mem.projectId}` : null,
    `importance: ${mem.importance ?? 0.5}`,
    `confidence: ${mem.confidence ?? 1}`,
    `source: ${mem.source || "user"}`,
    `created: ${mem.createdAt}`,
    `updated: ${mem.updatedAt || mem.createdAt}`,
    `synced: ${new Date().toISOString()}`,
    "---",
  ].filter(Boolean);
  return lines.join("\n");
}

function memoryMarkdown(mem) {
  const title = mem.content.split("\n")[0].slice(0, 120);
  const links = mem.projectId ? `\n\n## Bağlantılar\n- [[projects/${mem.projectId}]]` : "";
  const tagLine =
    mem.tags?.length > 0 ? `\n${mem.tags.map((t) => `#${t}`).join(" ")}` : "";
  return `${toFrontmatter(mem)}\n\n# ${title}\n\n${mem.content}${links}${tagLine}\n`;
}

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function writeVaultFile(relPath, body) {
  const full = join(vaultRoot(), relPath);
  await ensureDir(full);
  await writeFile(full, body, "utf8");
  return full;
}

/**
 * Export a single memory to vault
 */
export async function exportMemory(mem) {
  if (!isExportEnabled() || !mem?.id) return { skipped: true, reason: "export_disabled" };
  const rel = memoryRelPath(mem);
  const path = await writeVaultFile(rel, memoryMarkdown(mem));
  const contentHash = hashContent(mem.content);
  try {
    const mod = await import("../../core/persistence/index.js");
    await mod.upsertMemorySyncState({
      memoryId: mem.id,
      syncTarget: "obsidian",
      syncStatus: "synced",
      contentHash,
    });
  } catch {
    /* persistence optional */
  }
  return { synced: true, path, contentHash };
}

export async function deleteMemoryFromVault(mem) {
  if (!isExportEnabled() || !mem?.id) return { skipped: true };
  const rel = memoryRelPath(mem);
  const full = join(vaultRoot(), rel);
  const trash = join(vaultRoot(), "_trash", rel);
  try {
    await access(full);
    await ensureDir(trash);
    await rename(full, trash);
    return { trashed: true, path: trash };
  } catch {
    return { missing: true };
  }
}

export async function exportProfile() {
  if (!isExportEnabled()) return { skipped: true };
  const profile = await getProfile();
  const body = `---\ntype: profile\nnamespace: ${NAMESPACE}\nsynced: ${new Date().toISOString()}\n---\n\n# User Profile\n\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\`\n`;
  await writeVaultFile("profile/user-profile.md", body);
  return { synced: true };
}

export async function exportProjects() {
  if (!isExportEnabled()) return { skipped: true, count: 0 };
  const projects = await listProjects();
  let count = 0;
  for (const p of projects) {
    const slug = p.slug || p.name;
    const body = `---\ntype: project\nslug: ${slug}\nstatus: ${p.status || "active"}\nsynced: ${new Date().toISOString()}\n---\n\n# ${p.name}\n\n${p.description || ""}\n\n- Stack: ${p.stack || "—"}\n- Path: ${p.path || "—"}\n`;
    await writeVaultFile(`projects/${slug}.md`, body);
    count++;
  }
  return { synced: true, count };
}

export async function syncAllToVault({ limit = 500 } = {}) {
  if (!isExportEnabled()) {
    return {
      enabled: false,
      message: "Set OBSIDIAN_EXPORT_ENABLED=true and OBSIDIAN_VAULT_PATH",
    };
  }

  const memories = await listMemories({ limit });
  let synced = 0;
  let errors = 0;

  for (const mem of memories) {
    try {
      await exportMemory(mem);
      synced++;
    } catch (e) {
      errors++;
      console.warn("[obsidian-export] memory failed:", mem.id, e.message);
    }
  }

  try {
    await exportProfile();
    await exportProjects();
    await writeVaultFile(
      "_index.md",
      `# MCP Hub Sync\n\n- Namespace: ${NAMESPACE}\n- Last sync: ${new Date().toISOString()}\n- Memories: ${synced}\n- Errors: ${errors}\n`
    );
  } catch (e) {
    errors++;
  }

  return {
    enabled: true,
    vaultPath: process.env.OBSIDIAN_VAULT_PATH,
    synced,
    errors,
    total: memories.length,
  };
}

export function getObsidianStatus() {
  const enabled = isExportEnabled();
  return {
    enabled,
    vaultPath: enabled ? process.env.OBSIDIAN_VAULT_PATH : null,
    namespace: NAMESPACE,
  };
}

export { isExportEnabled, hashContent as obsidianContentHash };
