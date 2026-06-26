/**
 * Keep brain project registry in sync with projects.store.
 */

import { registerProject } from "../../plugins/brain/brain.memory.js";

/**
 * @param {{ key: string; name?: string; description?: string }} project
 */
export async function syncProjectToBrainStore(project) {
  if (!project?.key) return { synced: false };
  try {
    const entry = await registerProject({
      slug: project.key,
      name: project.name || project.key,
      description: project.description || "",
      status: "active",
      source: "projects.store",
    });
    return { synced: true, slug: entry?.slug || project.key };
  } catch (err) {
    console.warn("[project-brain-sync]", project.key, err.message);
    return { synced: false, error: err.message };
  }
}
