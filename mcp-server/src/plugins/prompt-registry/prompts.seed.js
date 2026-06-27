/**
 * Seed builtin prompt bundles into the on-disk prompt registry store.
 */

import { FELIX_DEFAULT_BUNDLE } from "../../core/chat/prompt-bundles/felix-default.js";
import { withStore } from "./prompts.store.js";

/**
 * Ensure felix-default exists in cache store (idempotent).
 * @returns {Promise<{ seeded: boolean; id: string }>}
 */
export async function ensureBuiltinPrompts() {
  const bundle = FELIX_DEFAULT_BUNDLE;
  const result = await withStore((store) => {
    const existing = store.prompts.find((p) => p.id === bundle.id);
    if (existing) {
      return { data: store, result: { seeded: false, id: bundle.id } };
    }
    const now = new Date().toISOString();
    const prompt = {
      id: bundle.id,
      name: bundle.name,
      description: bundle.description,
      mode: bundle.mode,
      contextSlots: [],
      toolsBundle: [],
      tags: bundle.tags,
      isDefault: bundle.isDefault,
      provenance: bundle.provenance,
      version: 1,
      sections: bundle.sections,
      createdAt: now,
      updatedAt: now,
    };
    store.prompts.push(prompt);
    store.versions[bundle.id] = { 1: { ...prompt } };
    return { data: store, result: { seeded: true, id: bundle.id } };
  });
  return result;
}
