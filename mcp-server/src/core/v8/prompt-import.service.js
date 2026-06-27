/**
 * V8 — import draft review queue + approved registry import.
 */

import { readFile, readdir, writeFile, mkdir, access, rename } from "fs/promises";
import { join } from "path";
import { validateProvenance } from "../chat/provenance.js";
import { scanPromptArchive, writeDraftReport } from "../chat/prompt-importer.js";
import { withStore } from "../../plugins/prompt-registry/prompts.store.js";
import { auditLog, generateCorrelationId } from "../audit/index.js";

const CACHE = process.env.CATALOG_CACHE_DIR || "./cache";
const DRAFTS_DIR = join(CACHE, "prompt-intelligence/drafts");
const REJECTED_DIR = join(CACHE, "prompt-intelligence/rejected");
const MANIFEST_PATH = join(CACHE, "prompt-intelligence/import-manifest.json");

async function ensureDirs() {
  await mkdir(DRAFTS_DIR, { recursive: true });
  await mkdir(REJECTED_DIR, { recursive: true });
}

async function readManifest() {
  try {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { approved: [], rejected: [] };
  }
}

async function writeManifest(manifest) {
  await mkdir(join(CACHE, "prompt-intelligence"), { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

async function readDraftFile(id) {
  const path = join(DRAFTS_DIR, `${id}.json`);
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

/**
 * @returns {Promise<object[]>}
 */
export async function listImportDrafts() {
  await ensureDirs();
  const manifest = await readManifest();
  const settled = new Set([...manifest.approved, ...manifest.rejected]);

  let files = [];
  try {
    files = (await readdir(DRAFTS_DIR)).filter((f) => f.endsWith(".json") && f !== "import-report.json");
  } catch {
    return [];
  }

  const drafts = [];
  for (const file of files) {
    const id = file.replace(/\.json$/, "");
    if (settled.has(id)) continue;
    try {
      const draft = await readDraftFile(id);
      drafts.push({
        id: draft.id || id,
        name: draft.name,
        description: draft.description,
        mode: draft.mode,
        tags: draft.tags,
        disabled: !!draft.disabled,
        risk: draft.provenance?.risk || "unknown",
        segmentCount: draft.segmentCount,
        sectionKeys: Object.keys(draft.sections || {}),
        provenance: draft.provenance,
      });
    } catch {
      /* skip */
    }
  }
  return drafts.sort((a, b) => a.id.localeCompare(b.id));
}

export async function getImportDraft(id) {
  try {
    const draft = await readDraftFile(id);
    return { ok: true, data: draft };
  } catch (err) {
    if (err.code === "ENOENT") {
      return { ok: false, error: { code: "not_found", message: "Draft not found" } };
    }
    throw err;
  }
}

/**
 * @param {string} sourceDir
 * @param {{ providerFilter?: string; maxFiles?: number }} opts
 */
export async function runImportScan(sourceDir, opts = {}) {
  const drafts = await scanPromptArchive(sourceDir, opts);
  if (drafts.length) {
    await writeDraftReport(DRAFTS_DIR, drafts);
  }
  return { count: drafts.length, drafts: drafts.map((d) => ({ id: d.id, risk: d.provenance?.risk })) };
}

/**
 * @param {string} id
 * @param {{ force?: boolean; actor?: string }} opts
 */
export async function approveImportDraft(id, opts = {}) {
  const draftResult = await getImportDraft(id);
  if (!draftResult.ok) return draftResult;

  const draft = draftResult.data;
  if (!validateProvenance(draft.provenance).ok) {
    return { ok: false, error: { code: "invalid_provenance", message: "Provenance metadata invalid" } };
  }
  if ((draft.provenance.risk === "high" || draft.disabled) && !opts.force) {
    return {
      ok: false,
      error: {
        code: "high_risk_review_required",
        message: "High-risk draft requires force=true after human review",
      },
    };
  }

  const promptId = draft.id.startsWith("draft-") ? draft.id.replace(/^draft-/, "imported-") : `imported-${draft.id}`;
  const now = new Date().toISOString();

  const imported = await withStore((store) => {
    if (store.prompts.some((p) => p.id === promptId || p.name === draft.name)) {
      return { data: store, result: { error: "duplicate", promptId } };
    }
    const prompt = {
      id: promptId,
      name: draft.name,
      description: draft.description || `Imported from ${draft.provenance.sourceProvider}`,
      mode: draft.mode || "agent",
      contextSlots: [],
      toolsBundle: [],
      tags: [...(draft.tags || []), "imported", "approved"],
      isDefault: false,
      provenance: draft.provenance,
      version: 1,
      sections: draft.sections || {},
      createdAt: now,
      updatedAt: now,
    };
    store.prompts.push(prompt);
    store.versions[promptId] = { 1: { ...prompt } };
    return { data: store, result: { promptId, name: prompt.name } };
  });

  if (imported.error === "duplicate") {
    return { ok: false, error: { code: "duplicate", message: `Prompt already exists: ${imported.promptId}` } };
  }

  const manifest = await readManifest();
  if (!manifest.approved.includes(id)) manifest.approved.push(id);
  await writeManifest(manifest);

  await auditLog({
    plugin: "prompt-registry",
    operation: "import_approve",
    actor: opts.actor || "admin",
    correlationId: generateCorrelationId(),
    success: true,
    allowed: true,
    metadata: { draftId: id, promptId: imported.promptId, risk: draft.provenance.risk },
  });

  return { ok: true, data: { draftId: id, promptId: imported.promptId, name: imported.name } };
}

export async function rejectImportDraft(id, { actor, reason } = {}) {
  const draftResult = await getImportDraft(id);
  if (!draftResult.ok) return draftResult;

  await ensureDirs();
  const src = join(DRAFTS_DIR, `${id}.json`);
  const dest = join(REJECTED_DIR, `${id}.json`);
  try {
    await rename(src, dest);
  } catch {
    /* file may already be moved */
  }

  const manifest = await readManifest();
  if (!manifest.rejected.includes(id)) manifest.rejected.push(id);
  await writeManifest(manifest);

  await auditLog({
    plugin: "prompt-registry",
    operation: "import_reject",
    actor: actor || "admin",
    correlationId: generateCorrelationId(),
    success: true,
    allowed: true,
    metadata: { draftId: id, reason: reason || null },
  });

  return { ok: true, data: { draftId: id, rejected: true } };
}
