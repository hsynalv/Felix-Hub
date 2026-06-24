/**
 * Obsidian vault ↔ brain two-way bridge for project-linked vaults.
 */

import { searchVaultNotes, readVaultNote } from "./vault-reader.js";
import { getProjectLinks } from "./project-context.service.js";
import { recordContextEvent } from "./project-context.service.js";

/**
 * Pull vault notes into brain memory (Redis). Skips gracefully if Redis unavailable.
 */
export async function pullVaultToBrain(projectKey, { limit = 30, sinceDays = 90 } = {}) {
  const links = getProjectLinks(projectKey);
  if (!links?.obsidianVaultPath) {
    return { ok: false, error: { code: "no_vault", message: "No obsidian vault linked" } };
  }

  const vaultPath = links.obsidianVaultPath;
  const search = await searchVaultNotes(vaultPath, "", { limit, sinceDays });
  if (!search.ok) return search;

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const { addMemory, listMemories, updateMemory } = await import("../../plugins/brain/brain.memory.js");
    const existing = await listMemories({ projectId: projectKey, limit: 500 });
    const bySourcePath = new Map(
      existing
        .filter((m) => m.tags?.includes("obsidian"))
        .map((m) => [m.content?.slice(0, 80), m])
    );

    for (const note of search.data.notes) {
      try {
        const full = await readVaultNote(vaultPath, note.path);
        if (!full.ok) {
          errors++;
          continue;
        }
        const content = `# ${note.title}\n\n${full.data.content}`;
        const tagKey = note.path;
        const prev = [...bySourcePath.values()].find((m) => m.tags?.includes(tagKey));
        if (prev) {
          await updateMemory(prev.id, { content, updatedAt: new Date().toISOString() });
          skipped++;
        } else {
          await addMemory({
            content,
            type: "project_note",
            tags: ["obsidian", tagKey],
            projectId: projectKey,
            source: "obsidian-vault",
            importance: 0.6,
          });
          imported++;
        }
      } catch {
        errors++;
      }
    }
  } catch (err) {
    return {
      ok: true,
      skippedBrain: true,
      reason: err.message,
      vaultNotes: search.data.count,
    };
  }

  await recordContextEvent(projectKey, {
    type: "obsidian_sync",
    summary: `Vault → brain: ${imported} new, ${skipped} updated`,
    refs: { vaultPath, imported, skipped, errors },
  });

  return {
    ok: true,
    projectId: projectKey,
    imported,
    updated: skipped,
    errors,
    vaultNotes: search.data.count,
  };
}

/**
 * Push brain memories for project to vault via brain.obsidian export (global vault path).
 */
export async function pushBrainToVault({ limit = 100 } = {}) {
  try {
    const mod = await import("../../plugins/brain/brain.obsidian.js");
    return mod.syncAllToVault({ limit });
  } catch (err) {
    return { ok: false, error: { code: "export_failed", message: err.message } };
  }
}
