/**
 * Read/search Obsidian vault notes from a project-linked path.
 */

import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";

async function walkMdFiles(dir, acc = [], depth = 0) {
  if (depth > 8) return acc;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) await walkMdFiles(full, acc, depth + 1);
    else if (ent.name.endsWith(".md")) acc.push(full);
  }
  return acc;
}

export async function searchVaultNotes(vaultPath, query = "", { limit = 20, sinceDays = 14 } = {}) {
  if (!vaultPath?.trim()) {
    return { ok: false, error: { code: "no_vault", message: "Vault path not configured" } };
  }

  const since = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  const files = await walkMdFiles(vaultPath.trim());
  const matches = [];

  for (const filePath of files) {
    try {
      const st = await stat(filePath);
      if (st.mtimeMs < since && st.ctimeMs < since) continue;
      const content = await readFile(filePath, "utf8");
      const rel = filePath.slice(vaultPath.length).replace(/^[/\\]/, "");
      const title = content.match(/^#\s+(.+)/m)?.[1] || rel;
      if (query && !content.toLowerCase().includes(query.toLowerCase()) && !rel.toLowerCase().includes(query.toLowerCase())) {
        continue;
      }
      matches.push({
        path: rel,
        title,
        modifiedAt: st.mtime.toISOString(),
        excerpt: content.replace(/^---[\s\S]*?---\n?/, "").slice(0, 200),
      });
      if (matches.length >= limit) break;
    } catch {
      /* skip */
    }
  }

  return { ok: true, data: { vaultPath, query, notes: matches, count: matches.length } };
}

export async function readVaultNote(vaultPath, relPath, { maxChars = 8000 } = {}) {
  if (!vaultPath?.trim() || !relPath) {
    return { ok: false, error: { code: "invalid_request", message: "vaultPath and relPath required" } };
  }
  if (relPath.includes("..")) {
    return { ok: false, error: { code: "invalid_path", message: "Path traversal not allowed" } };
  }
  const full = join(vaultPath.trim(), relPath);
  try {
    const content = await readFile(full, "utf8");
    return {
      ok: true,
      data: {
        path: relPath,
        content: content.slice(0, maxChars),
        truncated: content.length > maxChars,
      },
    };
  } catch (err) {
    return { ok: false, error: { code: "read_failed", message: err.message } };
  }
}

export async function listRecentVaultActivity(vaultPath, { sinceDays = 14, limit = 30 } = {}) {
  const result = await searchVaultNotes(vaultPath, "", { limit, sinceDays });
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      vaultPath,
      sinceDays,
      notes: result.data.notes,
      count: result.data.count,
    },
  };
}
