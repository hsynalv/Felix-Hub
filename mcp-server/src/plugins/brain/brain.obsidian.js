/**
 * Optional Obsidian vault export — secondary to in-hub Brain UI
 */

import { mkdir, writeFile, rename, access, readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { createHash } from "crypto";
import {
  getMemory,
  listMemories,
  listProjects,
  getProfile,
  updateMemory,
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
    hubSubdir: enabled ? vaultRoot() : null,
  };
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  const fm = match[1];
  const body = match[2];
  const idMatch = fm.match(/^id:\s*"?([^"\n]+)"?/m);
  if (!idMatch) return null;
  return { id: idMatch[1].trim(), body };
}

function extractMemoryContent(body) {
  let text = body.trim();
  const titleMatch = text.match(/^#\s+.+\r?\n\r?\n/);
  if (titleMatch) text = text.slice(titleMatch[0].length);
  const linksIdx = text.indexOf("\n\n## Bağlantılar");
  if (linksIdx >= 0) text = text.slice(0, linksIdx);
  text = text.replace(/\r?\n(#[\w-]+\s*)+$/g, "").trim();
  return text;
}

async function walkMdFiles(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) await walkMdFiles(full, acc);
    else if (ent.name.endsWith(".md")) acc.push(full);
  }
  return acc;
}

/**
 * Import memories from vault (vault wins on conflict — MVP)
 */
export async function importFromVault() {
  if (!isExportEnabled()) {
    return { enabled: false, message: "Set OBSIDIAN_EXPORT_ENABLED=true and OBSIDIAN_VAULT_PATH" };
  }

  const memDir = join(vaultRoot(), "memories");
  const files = await walkMdFiles(memDir);
  let updated = 0;
  let skipped = 0;
  let missing = 0;
  let errors = 0;

  for (const filePath of files) {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = parseFrontmatter(raw);
      if (!parsed?.id) {
        skipped++;
        continue;
      }
      const content = extractMemoryContent(parsed.body);
      const contentHash = hashContent(content);
      const existing = await getMemory(parsed.id);
      if (!existing) {
        missing++;
        continue;
      }
      if (hashContent(existing.content) === contentHash) {
        skipped++;
        continue;
      }
      await updateMemory(parsed.id, { content });
      try {
        const mod = await import("../../core/persistence/index.js");
        await mod.upsertMemorySyncState({
          memoryId: parsed.id,
          syncTarget: "obsidian",
          syncStatus: "synced",
          contentHash,
        });
      } catch {
        /* optional */
      }
      updated++;
    } catch (e) {
      errors++;
      console.warn("[obsidian-import] failed:", filePath, e.message);
    }
  }

  return { enabled: true, scanned: files.length, updated, skipped, missing, errors };
}

/**
 * Obsidian Canvas JSON export (grid layout)
 */
export async function exportCanvasJson({ limit = 200 } = {}) {
  const memories = await listMemories({ limit });
  const cols = 4;
  const cellW = 320;
  const cellH = 200;
  const gap = 40;
  const nodes = memories.map((mem, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const preview = mem.content.slice(0, 280);
    return {
      id: mem.id,
      type: "text",
      text: `# ${mem.type}\n\n${preview}`,
      x: col * (cellW + gap),
      y: row * (cellH + gap),
      width: cellW,
      height: cellH,
      color: "4",
    };
  });
  return { nodes, edges: [] };
}

/**
 * Generate MOC index pages for tags and projects
 */
export async function generateMocPages() {
  if (!isExportEnabled()) return { skipped: true };
  const memories = await listMemories({ limit: 1000 });
  const projects = await listProjects();
  const byTag = new Map();
  for (const mem of memories) {
    for (const tag of mem.tags || []) {
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag).push(mem);
    }
  }

  let tagPages = 0;
  for (const [tag, mems] of byTag) {
    const links = mems
      .map((m) => `- [[memories/${m.type}/${m.id}|${m.content.split("\n")[0].slice(0, 60)}]]`)
      .join("\n");
    const body = `---\ntype: moc\ntag: ${tag}\nsynced: ${new Date().toISOString()}\n---\n\n# Tag: ${tag}\n\n${links}\n`;
    await writeVaultFile(`moc/tags/${tag}.md`, body);
    tagPages++;
  }

  let projectPages = 0;
  for (const p of projects) {
    const slug = p.slug || p.name;
    const mems = memories.filter((m) => m.projectId === slug || m.projectId === p.name);
    const links = mems
      .map((m) => `- [[memories/${m.type}/${m.id}|${m.content.split("\n")[0].slice(0, 60)}]]`)
      .join("\n");
    const body = `---\ntype: moc\nproject: ${slug}\nsynced: ${new Date().toISOString()}\n---\n\n# Project: ${p.name}\n\n${links || "_No linked memories_\n"}\n`;
    await writeVaultFile(`moc/projects/${slug}.md`, body);
    projectPages++;
  }

  const tagIndex = [...byTag.keys()].map((t) => `- [[moc/tags/${t}|${t}]]`).join("\n");
  const projIndex = projects.map((p) => `- [[moc/projects/${p.slug || p.name}|${p.name}]]`).join("\n");
  await writeVaultFile(
    "moc/_index.md",
    `# MOC Index\n\n## Tags\n${tagIndex || "—"}\n\n## Projects\n${projIndex || "—"}\n`
  );

  return { tagPages, projectPages };
}

export async function writeDataviewSnippets() {
  if (!isExportEnabled()) return { skipped: true };
  const snippet = `\`\`\`dataview
TABLE type, project, updated
FROM "mcp-hub/memories"
WHERE id
SORT updated DESC
\`\`\`
`;
  await writeVaultFile("_snippets/dataview-memories.md", `# Dataview — Memories\n\n${snippet}`);
  return { written: true };
}

export async function runFullObsidianEnhancements() {
  const moc = await generateMocPages();
  const dv = await writeDataviewSnippets();
  return { moc, dataview: dv };
}

export { isExportEnabled, hashContent as obsidianContentHash };
